using System.Net;
using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Beta.Messages;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.AutoMate;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using DespatchWeb.Services.AutoMate;
using DespatchWeb.Services.AutoMate.Tools;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AutoMate;

public class AutoMateChatServiceTests
{
    private static readonly Guid TopId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid SecondId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    private readonly SseHandler _handler = new();
    private readonly AnthropicClient _anthropic;
    private AutoMateChatOptions _options = new() { MaxToolRounds = 1, GroundingTimeoutMs = 200 };
    private readonly AnthropicSettings _settings = new()
    {
        Chat = new AiModelProfile { Model = "claude-sonnet-5-5", Effort = "low", MaxTokens = 4096, TimeoutSeconds = 30 }
    };
    private readonly List<IAutoMateTool> _tools = [];
    private readonly ICspKnowledgeClient _knowledge = Substitute.For<ICspKnowledgeClient>();
    private readonly KbTurnSources _kbSources = new();
    private readonly AiCircuitBreaker _breaker = new();
    private AutoMateAudience _audience = AutoMateTestEnv.Staff();

    public AutoMateChatServiceTests()
    {
        _anthropic = new AnthropicClient
        {
            ApiKey = "test-api-key",
            HttpClient = new HttpClient(_handler),
            MaxRetries = 0
        };
    }

    private AutoMateChatService CreateSut() => new(
        _anthropic, _tools, Options.Create(_options), Options.Create(_settings), _knowledge, _kbSources, _audience, _breaker);

    private static AutoMateChatRequest Request(string message = "Hello", string? pageContext = null) =>
        new() { Messages = [new AutoMateChatMessage { Role = "user", Content = message }], PageContext = pageContext };

    private async Task<List<AutoMateStreamEvent>> Run(AutoMateChatRequest? request = null, CancellationToken? ct = null)
    {
        var events = new List<AutoMateStreamEvent>();
        await foreach (var evt in CreateSut().ChatStreamAsync(request ?? Request(), ct ?? TestContext.Current.CancellationToken))
        {
            events.Add(evt);
        }

        return events;
    }

    private void ConfigureKnowledge(params CspKbHit[] hits)
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbSearchResult(CspKbStatus.Ok, hits));
    }

    private static CspKbHit Hit(Guid id, string title, string content) => new(id, title, null, "Public", null, false, 1.0, content);

    private static JsonDocument Parse(string body) => JsonDocument.Parse(body);

    private static string SystemText(string body)
    {
        using var doc = Parse(body);
        return doc.RootElement.GetProperty("system").GetRawText();
    }

    private static string LastUserMessage(string body)
    {
        using var doc = Parse(body);
        return doc.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content").GetString()!;
    }

    private static List<string> ToolNames(string body)
    {
        using var doc = Parse(body);
        return doc.RootElement.TryGetProperty("tools", out var tools)
            ? tools.EnumerateArray().Select(t => t.GetProperty("name").GetString()!).ToList()
            : [];
    }

    // ----- Anthropic SSE helpers --------------------------------------------

    private static string Sse(string eventType, object data) => $"event: {eventType}\ndata: {JsonSerializer.Serialize(data)}\n\n";

    private static string MessageStart(int inputTokens = 10) => Sse("message_start", new
    {
        type = "message_start",
        message = new
        {
            id = "msg_test", type = "message", role = "assistant", content = Array.Empty<object>(),
            model = "claude-sonnet-5-5", stop_reason = (string?)null, stop_sequence = (string?)null,
            usage = new { input_tokens = inputTokens, output_tokens = 1 }
        }
    });

    private static string TextBlockStart(int index = 0) => Sse("content_block_start", new
    {
        type = "content_block_start", index, content_block = new { type = "text", text = "" }
    });

    private static string TextDelta(string text, int index = 0) => Sse("content_block_delta", new
    {
        type = "content_block_delta", index, delta = new { type = "text_delta", text }
    });

    private static string ToolBlockStart(string id, string name, int index = 0) => Sse("content_block_start", new
    {
        type = "content_block_start", index,
        content_block = new { type = "tool_use", id, name, input = new { }, caller = new { type = "direct" } }
    });

    private static string InputJson(string partialJson, int index = 0) => Sse("content_block_delta", new
    {
        type = "content_block_delta", index, delta = new { type = "input_json_delta", partial_json = partialJson }
    });

    private static string BlockStop(int index = 0) => Sse("content_block_stop", new { type = "content_block_stop", index });

    private static string MessageDelta(string stopReason, int outputTokens = 10) => Sse("message_delta", new
    {
        type = "message_delta",
        delta = new { stop_reason = stopReason, stop_sequence = (string?)null },
        usage = new { output_tokens = outputTokens }
    });

    private static string MessageStop() => Sse("message_stop", new { type = "message_stop" });

    private void QueueTextTurn(string text, string stopReason = "end_turn", int inputTokens = 10, int outputTokens = 10) =>
        _handler.Queue(MessageStart(inputTokens), TextBlockStart(), TextDelta(text), BlockStop(), MessageDelta(stopReason, outputTokens), MessageStop());

    private void QueueToolTurn(string toolName, string inputJson, string id = "tool_1") =>
        _handler.Queue(MessageStart(), ToolBlockStart(id, toolName), InputJson(inputJson), BlockStop(), MessageDelta("tool_use"), MessageStop());

    // ----- Streaming and validation -----------------------------------------

    [Fact]
    public async Task StreamsTextDeltas_ThenDone()
    {
        _handler.Queue(MessageStart(), TextBlockStart(), TextDelta("Hello "), TextDelta("world!"), BlockStop(), MessageDelta("end_turn"), MessageStop());

        var events = await Run();

        Assert.Equal(["text_delta", "text_delta", "done"], events.Select(e => e.Type));
        Assert.Equal("Hello world!", string.Concat(events.Where(e => e.Type == "text_delta").Select(e => e.Text)));
    }

    [Fact]
    public async Task SendsTheChatProfile_WithCachedPrefix_AndNoTemperature()
    {
        QueueTextTurn("OK");

        await Run();

        using var doc = Parse(Assert.Single(_handler.Bodies));
        Assert.Equal("claude-sonnet-5-5", doc.RootElement.GetProperty("model").GetString());
        Assert.Equal(4096, doc.RootElement.GetProperty("max_tokens").GetInt32());
        Assert.Equal("ephemeral", doc.RootElement.GetProperty("cache_control").GetProperty("type").GetString());
        Assert.Equal("ephemeral", doc.RootElement.GetProperty("system")[0].GetProperty("cache_control").GetProperty("type").GetString());
        Assert.Equal("low", doc.RootElement.GetProperty("output_config").GetProperty("effort").GetString());
        Assert.False(doc.RootElement.TryGetProperty("temperature", out _));
    }

    [Fact]
    public async Task SendsTheServerSideFallbackBeta()
    {
        QueueTextTurn("OK");

        await Run();

        Assert.Contains("fallback", Assert.Single(_handler.BetaHeaders), StringComparison.OrdinalIgnoreCase);
        using var doc = Parse(_handler.Bodies[0]);
        Assert.True(doc.RootElement.TryGetProperty("fallbacks", out _));
    }

    [Fact]
    public async Task NoMessages_IsA400Error()
    {
        var error = Assert.Single(await Run(new AutoMateChatRequest()));

        Assert.Equal("error", error.Type);
        Assert.Equal(400, error.HttpStatus);
        Assert.Empty(_handler.Bodies);
    }

    [Fact]
    public async Task AnOverlongMessage_IsA400Error()
    {
        var error = Assert.Single(await Run(Request(new string('a', _options.MaxMessageChars + 1))));

        Assert.Equal(400, error.HttpStatus);
        Assert.Contains("too long", error.Error);
        Assert.Empty(_handler.Bodies);
    }

    [Fact]
    public async Task AnOpenBreaker_IsA503_WithoutCallingAnthropic()
    {
        for (var i = 0; i < 5; i++)
        {
            _breaker.RecordFailure();
        }

        var error = Assert.Single(await Run());

        Assert.Equal(503, error.HttpStatus);
        Assert.Empty(_handler.Bodies);
    }

    [Fact]
    public async Task LeadingAssistantMessages_AreDropped_AfterCapping()
    {
        _options = new AutoMateChatOptions { MaxToolRounds = 1, GroundingTimeoutMs = 200, MaxConversationMessages = 2 };
        QueueTextTurn("OK");
        var request = new AutoMateChatRequest
        {
            Messages =
            [
                new AutoMateChatMessage { Role = "user", Content = "first" },
                new AutoMateChatMessage { Role = "assistant", Content = "reply" },
                new AutoMateChatMessage { Role = "user", Content = "second" }
            ]
        };

        await Run(request);

        using var doc = Parse(Assert.Single(_handler.Bodies));
        var messages = doc.RootElement.GetProperty("messages");
        Assert.Equal(1, messages.GetArrayLength());
        Assert.Equal("second", messages[0].GetProperty("content").GetString());
    }

    [Fact]
    public async Task PageContext_IsSanitisedAndPrependedToTheLastUserMessage()
    {
        QueueTextTurn("OK");

        await Run(Request("Question?", "Job <b>123</b>\nlist"));

        var message = LastUserMessage(Assert.Single(_handler.Bodies));
        Assert.StartsWith("<page-context>Job  b 123 /b  list</page-context>", message);
        Assert.EndsWith("Question?", message);
        Assert.DoesNotContain("Job  b 123", SystemText(_handler.Bodies[0]));
    }

    // ----- Grounding ---------------------------------------------------------

    [Fact]
    public async Task GroundingBlock_IsInTheLastUserMessage_NeverTheSystemPrompt()
    {
        ConfigureKnowledge(
            Hit(TopId, "Booking a job", "Step 1. Open Jobs.\nStep 2. Click <script>New</script>."),
            Hit(SecondId, "Cancelling a job", "Lead sentence here.\nSecond paragraph hidden."));
        QueueTextTurn("OK");

        await Run(Request("How do I book a job?"));

        await _knowledge.Received(1).SearchAsync(
            "How do I book a job?", 3, TimeSpan.FromMilliseconds(_options.GroundingTimeoutMs), Arg.Any<CancellationToken>());
        var body = Assert.Single(_handler.Bodies);
        var system = SystemText(body);
        var message = LastUserMessage(body);
        Assert.DoesNotContain("<knowledge-base>", system);
        Assert.DoesNotContain("Step 1. Open Jobs", system);
        Assert.DoesNotContain(TopId.ToString(), system);
        Assert.Contains("knowledge-base-use", system);
        Assert.Contains("<knowledge-base>", message);
        Assert.Contains("</knowledge-base>", message);
        Assert.Contains($"- [{TopId}] Booking a job: Step 1. Open Jobs.", message);
        Assert.Contains("Click  script New /script .", message);
        Assert.Contains($"- [{SecondId}] Cancelling a job: Lead sentence here.", message);
        Assert.DoesNotContain("Second paragraph hidden", message);
        Assert.EndsWith("How do I book a job?", message);
    }

    [Fact]
    public async Task TheBlockGoesOnTheLastUserMessage_OfALongerConversation()
    {
        ConfigureKnowledge(Hit(TopId, "Booking a job", "Steps."));
        QueueTextTurn("OK");
        var request = new AutoMateChatRequest
        {
            Messages =
            [
                new AutoMateChatMessage { Role = "user", Content = "earlier question" },
                new AutoMateChatMessage { Role = "assistant", Content = "earlier answer" },
                new AutoMateChatMessage { Role = "user", Content = "How do I book a job?" }
            ]
        };

        await Run(request);

        using var doc = Parse(Assert.Single(_handler.Bodies));
        var messages = doc.RootElement.GetProperty("messages");
        Assert.Equal("earlier question", messages[0].GetProperty("content").GetString());
        Assert.DoesNotContain("<knowledge-base>", messages[1].GetProperty("content").GetString());
        Assert.Contains("<knowledge-base>", messages[2].GetProperty("content").GetString());
    }

    [Fact]
    public async Task WhenCspIsNotConfigured_ThereIsNoBlock_NoSearch_NoKbTools_AndNoKbPromptSection()
    {
        _knowledge.IsConfigured.Returns(false);
        _tools.Add(new StubTool("get_job", staffOnly: true));
        _tools.Add(new SearchKnowledgeBaseTool(_knowledge, _kbSources, Options.Create(_options)));
        _tools.Add(new GetArticleTool(_knowledge, _kbSources, Options.Create(_options)));
        QueueTextTurn("OK");

        await Run(Request("How do I book a job?"));

        var body = Assert.Single(_handler.Bodies);
        Assert.DoesNotContain("<knowledge-base>", LastUserMessage(body));
        Assert.DoesNotContain("knowledge-base-use", SystemText(body));
        Assert.Equal(["get_job"], ToolNames(body));
        await _knowledge.DidNotReceive().SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WhenCspIsConfigured_TheKbToolsAreOffered()
    {
        ConfigureKnowledge();
        _tools.Add(new SearchKnowledgeBaseTool(_knowledge, _kbSources, Options.Create(_options)));
        _tools.Add(new GetArticleTool(_knowledge, _kbSources, Options.Create(_options)));
        QueueTextTurn("OK");

        await Run();

        Assert.Equal(["search_knowledge_base", "get_article"], ToolNames(Assert.Single(_handler.Bodies)));
    }

    [Fact]
    public async Task GroundingThatFinds_Nothing_AddsNoBlock()
    {
        ConfigureKnowledge();
        QueueTextTurn("OK");

        await Run();

        Assert.DoesNotContain("<knowledge-base>", LastUserMessage(Assert.Single(_handler.Bodies)));
    }

    [Fact]
    public async Task AnUnavailableCsp_StillCompletes_WithNoErrorEvent_AndNoBlock()
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(CspKbSearchResult.Unavailable);
        QueueTextTurn("Answer from my own knowledge.");

        var events = await Run();

        Assert.DoesNotContain(events, e => e.Type == "error");
        Assert.Equal("done", events[^1].Type);
        Assert.DoesNotContain("<knowledge-base>", LastUserMessage(Assert.Single(_handler.Bodies)));
    }

    [Fact]
    public async Task AGroundingSearchThatThrows_StillCompletes_WithNoErrorEvent()
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns<Task<CspKbSearchResult>>(_ => throw new InvalidOperationException("csp exploded"));
        QueueTextTurn("OK");

        var events = await Run();

        Assert.DoesNotContain(events, e => e.Type == "error");
        Assert.Equal("done", events[^1].Type);
    }

    [Fact]
    public async Task CallerCancellationDuringGrounding_Propagates()
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns<Task<CspKbSearchResult>>(_ => throw new OperationCanceledException());
        using var cts = new CancellationTokenSource();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Run(ct: cts.Token));
        Assert.Empty(_handler.Bodies);
    }

    [Fact]
    public async Task TheSearchQuery_IsTheLastUserMessage_TrimmedTo500Chars()
    {
        ConfigureKnowledge();
        QueueTextTurn("OK");

        await Run(Request(new string('q', 900)));

        await _knowledge.Received(1).SearchAsync(new string('q', 500), 3, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    // ----- Audience ----------------------------------------------------------

    [Fact]
    public async Task NonStaff_GetNoStaffOnlyTools_AndTheLimitedSystemPrompt()
    {
        _audience = AutoMateTestEnv.Customer();
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbSearchResult(CspKbStatus.Ok, []));
        _tools.Add(new StubTool("get_job", staffOnly: true));
        _tools.Add(new StubTool("find_client", staffOnly: true));
        _tools.Add(new SearchKnowledgeBaseTool(_knowledge, _kbSources, Options.Create(_options)));
        QueueTextTurn("OK");

        await Run();

        var body = Assert.Single(_handler.Bodies);
        Assert.Equal(["search_knowledge_base"], ToolNames(body));
        var system = SystemText(body);
        Assert.Contains("You have no tools for looking up jobs, drivers or clients", system);
        Assert.DoesNotContain("get_job for", system);
        Assert.DoesNotContain("find_drivers", system);
    }

    [Fact]
    public async Task Staff_GetTheStaffToolsAndTheFullSystemPrompt()
    {
        _knowledge.IsConfigured.Returns(false);
        _tools.Add(new StubTool("get_job", staffOnly: true));
        _tools.Add(new StubTool("lookup_open"));
        QueueTextTurn("OK");

        await Run();

        var body = Assert.Single(_handler.Bodies);
        Assert.Equal(["get_job", "lookup_open"], ToolNames(body));
        Assert.Contains("get_job for", SystemText(body));
        Assert.DoesNotContain("no tools for looking up jobs", SystemText(body));
    }

    [Fact]
    public async Task ANonStaffModelCallingAStaffTool_IsAnUnknownToolError_AndTheToolNeverRuns()
    {
        _audience = AutoMateTestEnv.Customer();
        var staffTool = new StubTool("get_job", staffOnly: true);
        _tools.Add(staffTool);
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{}");
        QueueTextTurn("Sorry.");

        await Run();

        Assert.Equal(0, staffTool.Executions);
        using var second = Parse(_handler.Bodies[1]);
        var result = second.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content")[0];
        Assert.True(result.GetProperty("is_error").GetBoolean());
    }

    // ----- Sources -----------------------------------------------------------

    [Fact]
    public async Task Done_CarriesTheArticlesTheAnswerNamesByTitle()
    {
        ConfigureKnowledge(Hit(TopId, "Booking a job", "Steps."), Hit(SecondId, "Cancelling a job", "Lead."));
        QueueTextTurn("Open Jobs and click New. See: Booking a job");

        var done = (await Run(Request("How do I book?"))).Last();

        var source = Assert.Single(done.Sources!);
        Assert.Equal(new KbSource(TopId, "Booking a job", false), source);
    }

    [Fact]
    public async Task Done_HasNoSources_WhenTheAnswerNamesNoTitle_EvenWithGroundingHits()
    {
        ConfigureKnowledge(Hit(TopId, "Booking a job", "Steps."));
        QueueTextTurn("Job 5 is allocated to Sam.");

        var done = (await Run(Request("Where is job 5?"))).Last();

        Assert.Equal("done", done.Type);
        Assert.Null(done.Sources);
    }

    [Fact]
    public async Task Done_IncludesArticlesRead_ThroughKbToolsThatTheAnswerNames()
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbSearchResult(CspKbStatus.Ok, []));
        _knowledge.GetArticleAsync(TopId, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new CspKbArticleResult(CspKbStatus.Ok, new CspKbArticle(TopId, "Rebooking a job", "Steps", null)));
        _tools.Add(new GetArticleTool(_knowledge, _kbSources, Options.Create(_options)));
        QueueToolTurn("get_article", $$"""{"article_id":"{{TopId}}"}""");
        QueueTextTurn("Do this. Article: Rebooking a job");

        var done = (await Run()).Last();

        Assert.Equal(TopId, Assert.Single(done.Sources!).ArticleId);
    }

    [Fact]
    public void CitedSources_PrefersTheLongerTitle_WhenOneNameContainsAnother()
    {
        var hits = new[] { Hit(TopId, "Booking", "x"), Hit(SecondId, "Booking a job", "y") };

        var sources = AutoMateChatService.CitedSources("See Booking a job.", hits, []);

        Assert.Equal(SecondId, Assert.Single(sources).ArticleId);
    }

    // ----- Tools -------------------------------------------------------------

    [Fact]
    public async Task AToolCall_EmitsToolUse_RunsTheTool_AndFeedsTheResultBack()
    {
        var tool = new StubTool("get_job", staffOnly: true, result: """{"data":"ok"}""");
        _tools.Add(tool);
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", """{"job_id":5}""");
        QueueTextTurn("Job 5 is fine.");

        var events = await Run();

        Assert.Equal(["tool_use", "text_delta", "done"], events.Select(e => e.Type));
        Assert.Equal("get_job", events[0].ToolName);
        Assert.Equal(1, tool.Executions);
        Assert.Equal(5, tool.LastInput!.Value.GetProperty("job_id").GetInt32());
        using var second = Parse(_handler.Bodies[1]);
        var messages = second.RootElement.GetProperty("messages");
        Assert.Equal("assistant", messages[1].GetProperty("role").GetString());
        var result = messages[2].GetProperty("content")[0];
        Assert.Equal("tool_result", result.GetProperty("type").GetString());
        Assert.False(result.TryGetProperty("is_error", out var isError) && isError.GetBoolean());
    }

    [Fact]
    public async Task AnUnavailableKbTool_ReturnsAnIsErrorToolResult_AndTheChatStillAnswers()
    {
        _knowledge.IsConfigured.Returns(true);
        _knowledge.SearchAsync(Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(CspKbSearchResult.Unavailable);
        _tools.Add(new SearchKnowledgeBaseTool(_knowledge, _kbSources, Options.Create(_options)));
        QueueToolTurn("search_knowledge_base", """{"query":"book a job"}""");
        QueueTextTurn("Help articles couldn't be checked.");

        var events = await Run();

        Assert.DoesNotContain(events, e => e.Type == "error");
        Assert.Equal("done", events[^1].Type);
        using var second = Parse(_handler.Bodies[1]);
        var result = second.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content")[0];
        Assert.True(result.GetProperty("is_error").GetBoolean());
        Assert.Contains("knowledge base is unavailable", result.GetProperty("content").GetRawText());
    }

    [Fact]
    public async Task ATool_ThatThrows_BecomesAGenericIsErrorResult_WithoutLeakingTheMessage()
    {
        _tools.Add(new StubTool("get_job", staffOnly: true, exception: new InvalidOperationException("DB connection failed")));
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{}");
        QueueTextTurn("Sorry.");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        Assert.DoesNotContain("DB connection failed", _handler.Bodies[1]);
        using var second = Parse(_handler.Bodies[1]);
        Assert.True(second.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content")[0].GetProperty("is_error").GetBoolean());
    }

    [Fact]
    public async Task AnUnknownTool_IsAnIsErrorResult()
    {
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("nope", "{}");
        QueueTextTurn("OK");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        using var second = Parse(_handler.Bodies[1]);
        Assert.True(second.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content")[0].GetProperty("is_error").GetBoolean());
    }

    [Fact]
    public async Task InvalidToolInputJson_IsAnIsErrorResult_AndTheToolDoesNotRun()
    {
        var tool = new StubTool("get_job", staffOnly: true);
        _tools.Add(tool);
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{not json");
        QueueTextTurn("OK");

        await Run();

        Assert.Equal(0, tool.Executions);
        using var second = Parse(_handler.Bodies[1]);
        Assert.True(second.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content")[0].GetProperty("is_error").GetBoolean());
    }

    [Fact]
    public async Task TheRoundAfterMaxToolRounds_SendsToolChoiceNone_ButKeepsTheToolDefinitions()
    {
        _tools.Add(new StubTool("get_job", staffOnly: true, result: """{"data":"ok"}"""));
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{}");
        QueueTextTurn("Here is the answer.");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        using var first = Parse(_handler.Bodies[0]);
        Assert.False(first.RootElement.TryGetProperty("tool_choice", out _));
        using var final = Parse(_handler.Bodies[1]);
        Assert.Equal("none", final.RootElement.GetProperty("tool_choice").GetProperty("type").GetString());
        Assert.Equal(1, final.RootElement.GetProperty("tools").GetArrayLength());
    }

    [Fact]
    public async Task AModelThatKeepsCallingToolsOnTheFinalRound_StillEndsInDone_WithoutRunningThem()
    {
        var tool = new StubTool("get_job", staffOnly: true);
        _tools.Add(tool);
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{}");
        QueueToolTurn("get_job", "{}");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        Assert.Equal(1, tool.Executions);
        Assert.Equal(2, _handler.Bodies.Count);
    }

    [Fact]
    public async Task TotalToolCalls_AreCapped_AndTheExtraCallsAnsweredWithErrors()
    {
        var tool = new StubTool("get_job", staffOnly: true);
        _tools.Add(tool);
        _knowledge.IsConfigured.Returns(false);
        _options = new AutoMateChatOptions { MaxToolRounds = 5, MaxToolCallsPerTurn = 2, GroundingTimeoutMs = 200 };
        _handler.Queue(MessageStart(),
            ToolBlockStart("t1", "get_job", 0), InputJson("{}", 0), BlockStop(0),
            ToolBlockStart("t2", "get_job", 1), InputJson("{}", 1), BlockStop(1),
            ToolBlockStart("t3", "get_job", 2), InputJson("{}", 2), BlockStop(2),
            MessageDelta("tool_use"), MessageStop());
        QueueTextTurn("Done.");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        Assert.Equal(2, tool.Executions);
        using var final = Parse(_handler.Bodies[1]);
        Assert.Equal("none", final.RootElement.GetProperty("tool_choice").GetProperty("type").GetString());
        var results = final.RootElement.GetProperty("messages").EnumerateArray().Last().GetProperty("content");
        Assert.Equal(3, results.GetArrayLength());
        Assert.True(results[2].GetProperty("is_error").GetBoolean());
        Assert.False(results[0].TryGetProperty("is_error", out var first) && first.GetBoolean());
    }

    [Fact]
    public async Task OversizedToolResults_AreTruncated()
    {
        _options = new AutoMateChatOptions { MaxToolRounds = 1, MaxToolResultChars = 1000, GroundingTimeoutMs = 200 };
        _tools.Add(new StubTool("get_job", staffOnly: true, result: new string('x', 50_000)));
        _knowledge.IsConfigured.Returns(false);
        QueueToolTurn("get_job", "{}");
        QueueTextTurn("Done.");

        await Run();

        Assert.Contains("[truncated", _handler.Bodies[1]);
        Assert.True(_handler.Bodies[1].Length < 10_000);
    }

    // ----- Failures, stop reasons, usage ------------------------------------

    [Fact]
    public async Task Anthropic5xx_IsAnErrorEvent_WithAStatus_AndDoesNotLeakDetail()
    {
        _handler.QueueResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("""{"type":"error","error":{"type":"api_error","message":"secret internal detail"}}""", Encoding.UTF8, "application/json")
        });

        var error = Assert.Single(await Run());

        Assert.Equal("error", error.Type);
        Assert.Equal(502, error.HttpStatus);
        Assert.DoesNotContain("secret internal detail", error.Error);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, 503)]
    [InlineData(HttpStatusCode.Forbidden, 503)]
    [InlineData(HttpStatusCode.NotFound, 503)]
    [InlineData(HttpStatusCode.TooManyRequests, 429)]
    [InlineData(HttpStatusCode.BadRequest, 400)]
    public async Task AnthropicClientErrors_MapToTheDocumentedStatus(HttpStatusCode upstream, int expected)
    {
        _handler.QueueResponse(new HttpResponseMessage(upstream)
        {
            Content = new StringContent("""{"type":"error","error":{"type":"invalid_request_error","message":"detail"}}""", Encoding.UTF8, "application/json")
        });

        var error = Assert.Single(await Run());

        Assert.Equal(expected, error.HttpStatus);
        Assert.DoesNotContain("detail", error.Error);
    }

    [Fact]
    public async Task RepeatedAnthropic5xx_OpensTheBreaker()
    {
        for (var i = 0; i < 5; i++)
        {
            _handler.QueueResponse(new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent("{}") });
            await Run();
        }

        var error = Assert.Single(await Run());

        Assert.Equal(503, error.HttpStatus);
        Assert.Equal(5, _handler.Bodies.Count);
    }

    [Fact]
    public async Task Done_CarriesTheTurnsUsage()
    {
        QueueTextTurn("OK", inputTokens: 123, outputTokens: 45);

        var done = (await Run()).Last();

        Assert.Equal(123, done.Usage!.Value.InputTokens);
        Assert.Equal(45, done.Usage.Value.OutputTokens);
    }

    [Fact]
    public async Task Usage_IsSummedAcrossToolRounds()
    {
        _tools.Add(new StubTool("get_job", staffOnly: true));
        _knowledge.IsConfigured.Returns(false);
        _handler.Queue(MessageStart(100), ToolBlockStart("t1", "get_job"), InputJson("{}"), BlockStop(), MessageDelta("tool_use", 20), MessageStop());
        QueueTextTurn("OK", inputTokens: 200, outputTokens: 30);

        var done = (await Run()).Last();

        Assert.Equal(300, done.Usage!.Value.InputTokens);
        Assert.Equal(50, done.Usage.Value.OutputTokens);
    }

    [Fact]
    public async Task ARefusal_IsA422Error_CarryingUsage()
    {
        QueueTextTurn("", stopReason: "refusal", inputTokens: 7, outputTokens: 3);

        var error = (await Run()).Last();

        Assert.Equal("error", error.Type);
        Assert.Equal(422, error.HttpStatus);
        Assert.Equal(7, error.Usage!.Value.InputTokens);
    }

    [Fact]
    public async Task MaxTokens_AppendsACutOffNotice_ThenDone()
    {
        QueueTextTurn("Partial answer", stopReason: "max_tokens");

        var events = await Run();

        Assert.Equal("done", events[^1].Type);
        Assert.Contains(events, e => e.Type == "text_delta" && e.Text!.Contains("cut off"));
    }

    [Fact]
    public async Task CallerCancellation_Propagates_WhileStreaming()
    {
        _handler.AsyncResponder = async (_, ct) =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        };
        using var cts = new CancellationTokenSource();
        var run = Run(ct: cts.Token);
        while (_handler.Bodies.Count == 0)
        {
            await Task.Delay(5, TestContext.Current.CancellationToken);
        }

        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => run);
    }

    // ----- Test doubles ------------------------------------------------------

    private sealed class SseHandler : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> _responses = new();
        private readonly List<string> _bodies = [];

        public List<string> Bodies
        {
            get
            {
                lock (_bodies)
                {
                    return [.. _bodies];
                }
            }
        }

        public Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>? AsyncResponder { get; set; }

        public List<string> BetaHeaders { get; } = [];

        public void Queue(params string[] events) =>
            QueueResponse(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(string.Concat(events), Encoding.UTF8, "text/event-stream")
            });

        public void QueueResponse(HttpResponseMessage response) => _responses.Enqueue(response);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = await request.Content!.ReadAsStringAsync(cancellationToken);
            lock (_bodies)
            {
                _bodies.Add(body);
                BetaHeaders.Add(request.Headers.TryGetValues("anthropic-beta", out var v) ? string.Join(",", v) : string.Empty);
            }

            if (AsyncResponder is not null)
            {
                return await AsyncResponder(request, cancellationToken);
            }

            return _responses.Count == 0
                ? new HttpResponseMessage(HttpStatusCode.InternalServerError) { Content = new StringContent("No more queued responses") }
                : _responses.Dequeue();
        }
    }

    private sealed class StubTool(string name, bool staffOnly = false, string result = "{}", Exception? exception = null) : IAutoMateTool
    {
        public BetaTool Definition => new()
        {
            Name = name,
            Description = $"Test tool: {name}",
            InputSchema = new InputSchema()
        };

        public bool StaffOnly => staffOnly;

        public int Executions { get; private set; }

        public JsonElement? LastInput { get; private set; }

        public Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
        {
            Executions++;
            LastInput = input.Clone();
            return exception is not null ? throw exception : Task.FromResult(result);
        }
    }
}
