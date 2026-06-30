using System.Text.Json;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiDraftingServiceTests
{
    private readonly IAiClientService _aiClientMock = Substitute.For<IAiClientService>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly ITenantInfoService _tenantInfoMock = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerDraft = 512
    });

    private AiDraftingService CreateService() => new(
        _aiClientMock,
        _jobRepositoryMock,
        _noteRepositoryMock,
        _tenantInfoMock,
        _settings);

    private void StubTextResponse(string text, int inputTokens = 50, int outputTokens = 10) =>
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = text,
                InputTokens = inputTokens,
                OutputTokens = outputTokens
            });

    private void StubEmailToolResponse(string subject, string body, int inputTokens = 80, int outputTokens = 30)
    {
        var response = new AiClientResponse { InputTokens = inputTokens, OutputTokens = outputTokens };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolUseId = "tool_1",
            ToolName = "emit_email_draft",
            ArgumentsJson = JsonSerializer.Serialize(new { subject, body })
        });

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(response);
    }

    // ----- Courier message --------------------------------------------------

    [Fact]
    public async Task DraftCourierMessageAsync_ReturnsTrimmedText()
    {
        StubTextResponse("  Hi Dave, pickup is running 30 min late.  ", 70, 18);
        var service = CreateService();

        var result = await service.DraftCourierMessageAsync(new DraftMessageRequest
        {
            RecipientName = "Dave",
            RecipientType = OtherMessagePartyType.Courier,
            MessageType = 2,
            Seed = "pu delayed 30min"
        });

        Assert.Equal("Hi Dave, pickup is running 30 min late.", result.Draft);
        Assert.Equal(70, result.Usage.InputTokens);
        Assert.Equal(18, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task DraftCourierMessageAsync_CallsClientWithoutTools()
    {
        StubTextResponse("ok");
        var service = CreateService();

        await service.DraftCourierMessageAsync(new DraftMessageRequest { Seed = "hi" });

        await _aiClientMock.Received(1).SendMessageAsync(
            Arg.Any<string>(), Arg.Any<List<AiMessage>>(), 512,
            null, null, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DraftCourierMessageAsync_SanitizesSeedAndRecentMessages()
    {
        string? capturedUserMessage = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(),
                Arg.Do<List<AiMessage>>(m => capturedUserMessage = m[0].Content),
                Arg.Any<int>(), Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { TextContent = "ok" });
        var service = CreateService();

        await service.DraftCourierMessageAsync(new DraftMessageRequest
        {
            Seed = "call me on 021 555 1234",
            RecentMessages = ["email me at dave@example.com"]
        });

        Assert.NotNull(capturedUserMessage);
        Assert.Contains("[PHONE]", capturedUserMessage);
        Assert.Contains("[EMAIL]", capturedUserMessage);
        Assert.DoesNotContain("021 555 1234", capturedUserMessage);
        Assert.DoesNotContain("dave@example.com", capturedUserMessage);
    }

    [Fact]
    public async Task DraftCourierMessageAsync_UsesRegionFromTenant()
    {
        _tenantInfoMock.IsUsTenant().Returns(true);
        string? capturedSystem = null;
        _aiClientMock.SendMessageAsync(
                Arg.Do<string>(s => capturedSystem = s),
                Arg.Any<List<AiMessage>>(), Arg.Any<int>(), Arg.Any<List<AiToolDefinition>>(),
                Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { TextContent = "ok" });
        var service = CreateService();

        await service.DraftCourierMessageAsync(new DraftMessageRequest { Seed = "hi" });

        Assert.NotNull(capturedSystem);
        Assert.Contains("US-based", capturedSystem);
    }

    // ----- Note -------------------------------------------------------------

    [Fact]
    public async Task DraftNoteAsync_ClientNoteType_PromptMentionsCustomer()
    {
        string? capturedSystem = null;
        _aiClientMock.SendMessageAsync(
                Arg.Do<string>(s => capturedSystem = s),
                Arg.Any<List<AiMessage>>(), Arg.Any<int>(), Arg.Any<List<AiToolDefinition>>(),
                Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { TextContent = "Customer requested a call." });
        var service = CreateService();

        var result = await service.DraftNoteAsync(new DraftNoteRequest
        {
            NoteTypeId = (int)NoteType.ClientNote,
            Seed = "cust wants call b4 delivery"
        });

        Assert.Equal("Customer requested a call.", result.Draft);
        Assert.NotNull(capturedSystem);
        Assert.Contains("client-facing", capturedSystem);
    }

    // ----- POD email --------------------------------------------------------

    [Fact]
    public async Task DraftPodEmailAsync_ParsesSubjectAndBody()
    {
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            JobNo = "J12345",
            ClientName = "Acme",
            ToAddress = "1 Queen St",
            PodName = "Jane Doe"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(Arg.Any<int>()).Returns(new List<TucNoteViewModel>());
        StubEmailToolResponse("Proof of Delivery - J12345", "Your shipment was delivered.", 110, 40);
        var service = CreateService();

        var result = await service.DraftPodEmailAsync(1);

        Assert.Equal("Proof of Delivery - J12345", result.Subject);
        Assert.Equal("Your shipment was delivered.", result.Body);
        Assert.Equal(110, result.Usage.InputTokens);
    }

    [Fact]
    public async Task DraftPodEmailAsync_JobNotFound_ReturnsFallback()
    {
        _jobRepositoryMock.GetSingleJobById(Arg.Any<int>()).Returns((JobViewModel?)null);
        var service = CreateService();

        var result = await service.DraftPodEmailAsync(999);

        Assert.Equal("Job not found.", result.Body);
        await _aiClientMock.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default!, default!, default, default, default, default, default);
    }

    // ----- Compose email ----------------------------------------------------

    [Fact]
    public async Task DraftEmailAsync_ParsesToolResult()
    {
        StubEmailToolResponse("Schedule change", "Hi team, please note the change.", 60, 22);
        var service = CreateService();

        var result = await service.DraftEmailAsync(new DraftEmailRequest
        {
            RecipientNames = ["Dave", "Sam"],
            SeedBody = "schedule changed"
        });

        Assert.Equal("Schedule change", result.Subject);
        Assert.Equal("Hi team, please note the change.", result.Body);
    }
}
