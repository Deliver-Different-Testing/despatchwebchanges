using System.Text;
using System.Text.Json;
using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace DespatchWeb.Tests.Controllers;

public class AiControllerChatTests
{
    private static readonly Guid ArticleId = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private readonly IAiRateLimiter _rateLimiter = Substitute.For<IAiRateLimiter>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly IAutoMateChatService _chat = Substitute.For<IAutoMateChatService>();
    private readonly DefaultHttpContext _http = new();
    private readonly MemoryStream _body = new();

    public AiControllerChatTests()
    {
        _tenantInfo.GetStaffIdOrNull().Returns(1);
        _tenantInfo.GetTenantTimeZone().Returns("Pacific/Auckland");
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(true);
        _http.Response.Body = _body;
    }

    private AiController CreateController() => new(
        Substitute.For<IAiSummarizationService>(),
        Substitute.For<IAiDraftingService>(),
        Substitute.For<IAiInsightsService>(),
        _rateLimiter,
        _tenantInfo,
        Substitute.For<IAiAuditLog>())
    {
        ControllerContext = new ControllerContext { HttpContext = _http }
    };

    private void Stream(params AutoMateStreamEvent[] events) =>
        _chat.ChatStreamAsync(Arg.Any<AutoMateChatRequest>(), Arg.Any<CancellationToken>()).Returns(ToAsync(events));

    private static async IAsyncEnumerable<AutoMateStreamEvent> ToAsync(IEnumerable<AutoMateStreamEvent> events)
    {
        foreach (var evt in events)
        {
            yield return evt;
            await Task.Yield();
        }
    }

    private string Written => Encoding.UTF8.GetString(_body.ToArray());

    private List<JsonElement> DataLines() => Written
        .Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
        .Select(frame =>
        {
            Assert.StartsWith("data: ", frame);
            return JsonDocument.Parse(frame["data: ".Length..]).RootElement.Clone();
        })
        .ToList();

    private Task Act(AutoMateChatRequest? request = null) =>
        CreateController().Chat(request!, _chat, TestContext.Current.CancellationToken);

    [Fact]
    public async Task RateLimited_Returns429_WithAnErrorBody_AndNeverCallsTheChatService()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);

        await Act(new AutoMateChatRequest());

        Assert.Equal(429, _http.Response.StatusCode);
        Assert.Contains("Too many requests", JsonDocument.Parse(Written).RootElement.GetProperty("error").GetString());
        _chat.DidNotReceive().ChatStreamAsync(Arg.Any<AutoMateChatRequest>(), Arg.Any<CancellationToken>());
        await _rateLimiter.DidNotReceive().RecordTokenUsageAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiTaskClass>(), Arg.Any<AiUsageInfo>());
    }

    [Fact]
    public async Task AnErrorBeforeAnyOutput_BecomesTheRealHttpStatus_WithAJsonBody()
    {
        Stream(new AutoMateStreamEvent { Type = "error", Error = "Auto-mate is busy right now.", HttpStatus = 429 });

        await Act(new AutoMateChatRequest());

        Assert.Equal(429, _http.Response.StatusCode);
        Assert.NotEqual("text/event-stream", _http.Response.ContentType);
        var json = JsonDocument.Parse(Written).RootElement;
        Assert.Equal("Auto-mate is busy right now.", json.GetProperty("error").GetString());
        Assert.DoesNotContain("data:", Written);
    }

    [Fact]
    public async Task AnErrorBeforeAnyOutput_StillRecordsTheUsageItCarries()
    {
        var usage = new AiUsageInfo { InputTokens = 5, OutputTokens = 1 };
        Stream(new AutoMateStreamEvent { Type = "error", Error = "x", HttpStatus = 422, Usage = usage });

        await Act(new AutoMateChatRequest());

        await _rateLimiter.Received(1).RecordTokenUsageAsync(1, "Pacific/Auckland", "Chat", AiTaskClass.Chat, usage);
    }

    [Fact]
    public async Task TheStream_IsServerSentEvents_WithCamelCaseJson_AndNoNullsOrInternalFields()
    {
        Stream(
            new AutoMateStreamEvent { Type = "tool_use", ToolName = "get_job" },
            new AutoMateStreamEvent { Type = "text_delta", Text = "Hi" },
            new AutoMateStreamEvent
            {
                Type = "done",
                Sources = [new KbSource(ArticleId, "Booking a job", true)],
                Usage = new AiUsageInfo { InputTokens = 10, OutputTokens = 5 },
                HttpStatus = 200
            });

        await Act(new AutoMateChatRequest());

        Assert.Equal(200, _http.Response.StatusCode);
        Assert.Equal("text/event-stream", _http.Response.ContentType);
        Assert.Equal("no-cache", _http.Response.Headers.CacheControl.ToString());
        Assert.Equal("no", _http.Response.Headers["X-Accel-Buffering"].ToString());
        Assert.StartsWith("data: ", Written);
        Assert.EndsWith("\n\n", Written);

        var lines = DataLines();
        Assert.Equal(3, lines.Count);
        Assert.Equal("""{"type":"tool_use","toolName":"get_job"}""", lines[0].GetRawText());
        Assert.Equal("""{"type":"text_delta","text":"Hi"}""", lines[1].GetRawText());
        var done = lines[2];
        Assert.Equal("done", done.GetProperty("type").GetString());
        var source = done.GetProperty("sources")[0];
        Assert.Equal(ArticleId, source.GetProperty("articleId").GetGuid());
        Assert.Equal("Booking a job", source.GetProperty("title").GetString());
        Assert.True(source.GetProperty("isFaq").GetBoolean());
        Assert.False(done.TryGetProperty("usage", out _));
        Assert.False(done.TryGetProperty("httpStatus", out _));
        Assert.False(done.TryGetProperty("text", out _));
    }

    [Fact]
    public async Task AMidStreamError_IsWrittenAsAnEvent_NotAnHttpStatus()
    {
        Stream(
            new AutoMateStreamEvent { Type = "text_delta", Text = "Partial" },
            new AutoMateStreamEvent { Type = "error", Error = "Couldn't reach Auto-mate.", HttpStatus = 502 });

        await Act(new AutoMateChatRequest());

        Assert.Equal(200, _http.Response.StatusCode);
        var lines = DataLines();
        Assert.Equal("error", lines[1].GetProperty("type").GetString());
        Assert.Equal("Couldn't reach Auto-mate.", lines[1].GetProperty("error").GetString());
    }

    [Fact]
    public async Task UsageOnTheLastEvent_IsRecordedAgainstTheChatTaskClass()
    {
        var usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 40, CacheReadInputTokens = 20 };
        Stream(
            new AutoMateStreamEvent { Type = "text_delta", Text = "Hi" },
            new AutoMateStreamEvent { Type = "done", Usage = usage });

        await Act(new AutoMateChatRequest());

        await _rateLimiter.Received(1).RecordTokenUsageAsync(1, "Pacific/Auckland", "Chat", AiTaskClass.Chat, usage);
    }

    [Fact]
    public async Task NoUsage_RecordsNothing()
    {
        Stream(new AutoMateStreamEvent { Type = "done" });

        await Act(new AutoMateChatRequest());

        await _rateLimiter.DidNotReceive().RecordTokenUsageAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<AiTaskClass>(), Arg.Any<AiUsageInfo>());
    }

    [Fact]
    public async Task CustomersWithoutAStaffId_AreKeyedByTheirNegatedContactId()
    {
        _tenantInfo.GetStaffIdOrNull().Returns((int?)null);
        _tenantInfo.GetContactId().Returns(55);
        Stream(new AutoMateStreamEvent { Type = "done", Usage = new AiUsageInfo { InputTokens = 1 } });

        await Act(new AutoMateChatRequest());

        await _rateLimiter.Received(1).TryAcquireAsync(-55, "Pacific/Auckland");
        await _rateLimiter.Received(1).RecordTokenUsageAsync(-55, "Pacific/Auckland", "Chat", AiTaskClass.Chat, Arg.Any<AiUsageInfo>());
    }

    [Fact]
    public async Task ANullBody_IsPassedOnAsAnEmptyRequest()
    {
        AutoMateChatRequest? seen = null;
        _chat.ChatStreamAsync(Arg.Do<AutoMateChatRequest>(r => seen = r), Arg.Any<CancellationToken>())
            .Returns(ToAsync([new AutoMateStreamEvent { Type = "done" }]));

        await Act(null);

        Assert.NotNull(seen);
        Assert.Empty(seen.Messages);
    }

    [Fact]
    public async Task AFailureBeforeStreaming_Is500_WithAGenericJsonError()
    {
        _chat.ChatStreamAsync(Arg.Any<AutoMateChatRequest>(), Arg.Any<CancellationToken>())
            .Returns(Throwing());

        await Act(new AutoMateChatRequest());

        Assert.Equal(500, _http.Response.StatusCode);
        var error = JsonDocument.Parse(Written).RootElement.GetProperty("error").GetString();
        Assert.DoesNotContain("boom", error);
        return;

        static async IAsyncEnumerable<AutoMateStreamEvent> Throwing()
        {
            await Task.Yield();
            throw new InvalidOperationException("boom");
#pragma warning disable CS0162
            yield break;
#pragma warning restore CS0162
        }
    }

    [Fact]
    public async Task CallerCancellation_EndsQuietly_WithoutAnErrorStatus()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();
        _chat.ChatStreamAsync(Arg.Any<AutoMateChatRequest>(), Arg.Any<CancellationToken>())
            .Returns(call => Cancelled(call.Arg<CancellationToken>()));

        await CreateController().Chat(new AutoMateChatRequest(), _chat, cts.Token);

        Assert.Equal(200, _http.Response.StatusCode);
        return;

        static async IAsyncEnumerable<AutoMateStreamEvent> Cancelled(CancellationToken ct)
        {
            await Task.Yield();
            ct.ThrowIfCancellationRequested();
            yield break;
        }
    }
}
