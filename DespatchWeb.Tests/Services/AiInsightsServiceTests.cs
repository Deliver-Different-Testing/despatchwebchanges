using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

public class AiInsightsServiceTests
{
    private readonly IAiClientService _aiClient = Substitute.For<IAiClientService>();
    private readonly INoteRepository _noteRepository = Substitute.For<INoteRepository>();
    private readonly IJobQueryRepository _jobRepository = Substitute.For<IJobQueryRepository>();
    private readonly IAccessorialChargeService _accessorialService = Substitute.For<IAccessorialChargeService>();
    private readonly IRateJobService _rateJobService = Substitute.For<IRateJobService>();
    private readonly IJobChangeRequestService _changeRequestService = Substitute.For<IJobChangeRequestService>();
    private readonly IMessageRepository _messageRepository = Substitute.For<IMessageRepository>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private string? _capturedSystemPrompt;
    private string? _capturedUserMessage;
    private string? _capturedForcedTool;
    private AiTaskClass _capturedTaskClass;

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        Judgment = new AiModelProfile { Model = "claude-sonnet-5", Effort = "low", MaxTokens = 1024 }
    });
    private static readonly string[] StringArray = ["3% below rate card"];

    private AiInsightsService CreateService() => new(
        _aiClient, _noteRepository, _jobRepository, _accessorialService,
        _rateJobService, _changeRequestService, _messageRepository, _tenantInfo, _settings);

    private void StubToolResponse(string toolName, object payload, int inputTokens = 80, int outputTokens = 25)
    {
        var response = new AiClientResponse { InputTokens = inputTokens, OutputTokens = outputTokens };
        response.ToolCalls.Add(new AiToolCall
        {
            ToolUseId = "tool_1",
            ToolName = toolName,
            ArgumentsJson = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })
        });

        _aiClient.SendMessageAsync(
                Arg.Any<AiTaskClass>(),
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                _capturedTaskClass = call.ArgAt<AiTaskClass>(0);
                _capturedSystemPrompt = call.ArgAt<string>(1);
                _capturedUserMessage = call.ArgAt<List<AiMessage>>(2)[0].Content;
                _capturedForcedTool = call.ArgAt<string>(5);
                return response;
            });
    }

    // ---- Blockers ---------------------------------------------------------

    [Fact]
    public async Task ExtractBlockersAsync_NoNotes_ReturnsOkWithoutCallingAi()
    {
        _noteRepository.GetNotesByJobIdAsync(1).Returns(new List<TucNoteViewModel>());
        var service = CreateService();

        var result = await service.ExtractBlockersAsync(1, TestContext.Current.CancellationToken);

        Assert.Empty(result.Blockers);
        Assert.Equal(SummarySeverity.Ok, result.Severity);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    [Fact]
    public async Task ExtractBlockersAsync_ParsesBlockers()
    {
        _noteRepository.GetNotesByJobIdAsync(1).Returns(new List<TucNoteViewModel>
        {
            new() { NoteText = "Ring buzzer, gate code 1234", NoteTypeName = "Delivery Notes" }
        });
        StubToolResponse("emit_blockers", new
        {
            blockers = new[] { new { tag = "gate-code-needed", severity = "Caution", evidence = "gate code 1234", actionRequired = true } },
            summary = "1 blocker: gate-code",
            severity = "Caution"
        });
        var service = CreateService();

        var result = await service.ExtractBlockersAsync(1, TestContext.Current.CancellationToken);

        Assert.Single(result.Blockers);
        Assert.Equal("gate-code-needed", result.Blockers[0].Tag);
        Assert.Equal(SummarySeverity.Caution, result.Blockers[0].Severity);
        Assert.Equal(SummarySeverity.Caution, result.Severity);
    }

    // ---- Pricing ----------------------------------------------------------

    [Fact]
    public async Task AnalyzePricingAsync_ComputesOutlierFromReRate()
    {
        _jobRepository.GetSingleJobById(1).Returns(new JobViewModel { JobNo = "J1", Charge = 95m });
        _rateJobService.GetJobRateNzAsync(Arg.Any<DespatchWeb.Models.Dto.JobRatingDetailsDtoNz>())
            .Returns(new ApiRerate { Rate = 145m });
        _accessorialService.GetAvailableChargesAsync(Arg.Any<int>(), Arg.Any<int>())
            .Returns(new List<AccessorialChargeDto>()); // empty catalog → no AI suggestions
        var service = CreateService();

        var result = await service.AnalyzePricingAsync(1, 5, TestContext.Current.CancellationToken);

        Assert.NotNull(result.Anomaly);
        Assert.Equal(95m, result.Anomaly!.StoredCharge);
        Assert.Equal(145m, result.Anomaly.RecomputedRate);
        Assert.True(result.Anomaly.IsOutlier); // (95-145)/145 = -34.5%
        Assert.Empty(result.Suggestions);
    }

    [Fact]
    public async Task AnalyzePricingAsync_ReRateThrows_AnomalyNull()
    {
        _jobRepository.GetSingleJobById(1).Returns(new JobViewModel { JobNo = "J1", Charge = 100m });
        _rateJobService.GetJobRateNzAsync(Arg.Any<DespatchWeb.Models.Dto.JobRatingDetailsDtoNz>())
            .ThrowsAsync(new Exception("DFRNT down"));
        _accessorialService.GetAvailableChargesAsync(Arg.Any<int>(), Arg.Any<int>())
            .Returns(new List<AccessorialChargeDto>());
        var service = CreateService();

        var result = await service.AnalyzePricingAsync(1, 5, TestContext.Current.CancellationToken);

        Assert.Null(result.Anomaly);
    }

    [Fact]
    public async Task AnalyzePricingAsync_DropsSuggestionsNotInCatalog()
    {
        // No stored charge → anomaly skipped; focus on the catalog guard.
        _jobRepository.GetSingleJobById(1).Returns(new JobViewModel { JobNo = "J1", Charge = null });
        _noteRepository.GetNotesByJobIdAsync(1).Returns(new List<TucNoteViewModel>());
        _accessorialService.GetAvailableChargesAsync(5, 1).Returns(new List<AccessorialChargeDto>
        {
            new() { AccessorialChargeId = 5, Name = "Tail-lift", ChargeType = "flat" }
        });
        StubToolResponse("emit_accessorial_suggestions", new
        {
            suggestions = new[]
            {
                new { accessorialChargeId = 5, name = "Tail-lift", reason = "tail-lift flag set", suggestedInputValue = (decimal?)null },
                new { accessorialChargeId = 99, name = "Hallucinated", reason = "not in catalog", suggestedInputValue = (decimal?)null }
            }
        });
        var service = CreateService();

        var result = await service.AnalyzePricingAsync(1, 5, TestContext.Current.CancellationToken);

        Assert.Single(result.Suggestions);
        Assert.Equal(5, result.Suggestions[0].AccessorialChargeId);
    }

    // ---- Triage -----------------------------------------------------------

    [Fact]
    public async Task TriageChangeRequestAsync_ParsesRecommendation()
    {
        _changeRequestService.ListForJobAsync(1, Arg.Any<CancellationToken>())
            .Returns(new List<JobChangeRequestDto>
            {
                new() { Id = 42, JobId = 1, FieldName = "PartnerAgreedRate", Reason = "volume discount" }
            });
        _jobRepository.GetSingleJobById(1).Returns(new JobViewModel { JobNo = "J1" });
        StubToolResponse("emit_triage", new
        {
            recommendedAction = "approve",
            confidence = 0.82,
            rationale = "Rate change aligns with volume.",
            riskFactors = StringArray
        });
        var service = CreateService();

        var result = await service.TriageChangeRequestAsync(42, 1, TestContext.Current.CancellationToken);

        Assert.Equal("approve", result.RecommendedAction);
        Assert.Equal(0.82, result.Confidence, 3);
        Assert.Single(result.RiskFactors);
    }

    [Fact]
    public async Task TriageChangeRequestAsync_NotFound_ReturnsClarify()
    {
        _changeRequestService.ListForJobAsync(1, Arg.Any<CancellationToken>())
            .Returns(new List<JobChangeRequestDto>());
        var service = CreateService();

        var result = await service.TriageChangeRequestAsync(42, 1, TestContext.Current.CancellationToken);

        Assert.Equal("clarify", result.RecommendedAction);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    // ---- Inbox triage -----------------------------------------------------

    private void StubInbox(params RecentMessageViewModel[] conversations) =>
        _messageRepository.GetRecentListAsync().Returns(conversations);

    private static RecentMessageViewModel Conversation(
        int id, string name, string lastMessage, OtherMessagePartyType type = OtherMessagePartyType.Courier) =>
        new()
        {
            OtherPartyId = id,
            OtherPartyType = type,
            OtherPartyName = name,
            UnreadCount = 1,
            LastMessage = lastMessage,
            LastMessageTime = new DateTime(2026, 9, 14, 8, 30, 0)
        };

    [Fact]
    public async Task TriageInboxAsync_NoConversations_ReturnsEmptyWithoutCallingAi()
    {
        StubInbox();

        var result = await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.Empty(result.Conversations);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    [Fact]
    public async Task TriageInboxAsync_TriagesTheWholeListInOneCall()
    {
        StubInbox(
            Conversation(4, "Dave", "Stuck at the gate on J1234, need the code"),
            Conversation(9, "Sam", "All done for today"));
        StubToolResponse("emit_inbox_triage", new
        {
            conversations = new object[]
            {
                new
                {
                    conversationIndex = 0, intent = "problem", urgency = "urgent",
                    summary = "Needs gate code for J1234", jobReferences = new[] { "J1234" },
                    suggestedResponseId = (int?)null
                },
                new
                {
                    conversationIndex = 1, intent = "statusUpdate", urgency = "routine",
                    summary = "Finished for the day", jobReferences = Array.Empty<string>(),
                    suggestedResponseId = (int?)null
                }
            }
        });

        var result = await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        await _aiClient.Received(1).SendMessageAsync(
            Arg.Any<AiTaskClass>(), Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
            Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>(),
            Arg.Any<CancellationToken>());

        Assert.Equal(2, result.Conversations.Count);
        Assert.Equal(4, result.Conversations[0].OtherPartyId);
        Assert.Equal(OtherMessagePartyType.Courier, result.Conversations[0].OtherPartyType);
        Assert.Equal(MessageIntent.Problem, result.Conversations[0].Intent);
        Assert.Equal(MessageUrgency.Urgent, result.Conversations[0].Urgency);
        Assert.Equal("J1234", Assert.Single(result.Conversations[0].JobReferences));
        Assert.Equal(9, result.Conversations[1].OtherPartyId);
        Assert.Equal(MessageIntent.StatusUpdate, result.Conversations[1].Intent);
    }

    [Fact]
    public async Task TriageInboxAsync_RunsOnTheDraftingTierBecauseItFiresOnEveryInboxOpen()
    {
        StubInbox(Conversation(1, "Dave", "hi"));
        StubToolResponse("emit_inbox_triage", new { conversations = Array.Empty<object>() });

        await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.Equal(AiTaskClass.Drafting, _capturedTaskClass);
    }

    [Fact]
    public async Task TriageInboxAsync_DiscardsAQuickResponseIdOutsideTheCatalog()
    {
        StubInbox(Conversation(1, "Dave", "When am I paid?"));
        _messageRepository.GetSavedQuickResponsesAsync()
            .Returns([new Suggestion { Id = 5, Text = "Pay runs Wednesday" }]);
        StubToolResponse("emit_inbox_triage", new
        {
            conversations = new[]
            {
                new
                {
                    conversationIndex = 0, intent = "pay", urgency = "routine",
                    summary = "Asking when pay lands", jobReferences = Array.Empty<string>(),
                    suggestedResponseId = 99
                }
            }
        });

        var result = await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.Null(Assert.Single(result.Conversations).SuggestedResponseId);
    }

    [Fact]
    public async Task TriageInboxAsync_KeepsAQuickResponseIdFromTheCatalog()
    {
        StubInbox(Conversation(1, "Dave", "When am I paid?"));
        _messageRepository.GetSavedQuickResponsesAsync()
            .Returns([new Suggestion { Id = 5, Text = "Pay runs Wednesday" }]);
        StubToolResponse("emit_inbox_triage", new
        {
            conversations = new[]
            {
                new
                {
                    conversationIndex = 0, intent = "pay", urgency = "routine",
                    summary = "Asking when pay lands", jobReferences = Array.Empty<string>(),
                    suggestedResponseId = 5
                }
            }
        });

        var result = await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.Equal(5, Assert.Single(result.Conversations).SuggestedResponseId);
    }

    [Fact]
    public async Task TriageInboxAsync_DropsARowPointingAtNoConversation()
    {
        StubInbox(Conversation(1, "Dave", "hi"));
        StubToolResponse("emit_inbox_triage", new
        {
            conversations = new[]
            {
                new
                {
                    conversationIndex = 7, intent = "other", urgency = "routine",
                    summary = "invented", jobReferences = Array.Empty<string>(),
                    suggestedResponseId = (int?)null
                }
            }
        });

        var result = await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.Empty(result.Conversations);
    }

    [Fact]
    public async Task TriageInboxAsync_RedactsPiiBeforeTheMessageReachesThePrompt()
    {
        StubInbox(Conversation(1, "Dave", "Ring the site on 021-555-1234 or jo@acme.co.nz"));
        StubToolResponse("emit_inbox_triage", new { conversations = Array.Empty<object>() });

        await CreateService().TriageInboxAsync(TestContext.Current.CancellationToken);

        Assert.DoesNotContain("021-555-1234", _capturedUserMessage);
        Assert.DoesNotContain("jo@acme.co.nz", _capturedUserMessage);
    }

    // ---- Price explanation ------------------------------------------------

    [Fact]
    public async Task ExplainPriceAsync_NoComponents_SaysSoWithoutCallingAi()
    {
        _jobRepository.GetJobPriceBreakdownAsync(1, false).Returns([]);

        var result = await CreateService().ExplainPriceAsync(1, ct: TestContext.Current.CancellationToken);

        Assert.Contains("no price breakdown", result.Headline);
        await _aiClient.DidNotReceiveWithAnyArgs().SendMessageAsync(
            default, null!, null!, 0, null, null, false, false, CancellationToken.None);
    }

    [Fact]
    public async Task ExplainPriceAsync_PassesEveryComponentAndTheTotalToThePrompt()
    {
        _jobRepository.GetJobPriceBreakdownAsync(1, false).Returns([
            new ChargeViewModel { ChargeId = 1, Name = "Base rate", Amount = 100m },
            new ChargeViewModel { ChargeId = 2, Name = "Waiting time", Amount = 45.50m }
        ]);
        StubToolResponse("emit_price_explanation", new
        {
            headline = "$145.50 NZD — a 42 km urgent run",
            lines = new[]
            {
                new { name = "Base rate", amount = 100.0, explanation = "The standard charge for the distance." },
                new { name = "Waiting time", amount = 45.5, explanation = "The driver waited 45 minutes on site." }
            },
            queryRisks = new[] { new { component = "Waiting time", evidence = "on site 10:05, signed 10:50" } },
            caveats = Array.Empty<string>()
        });

        var result = await CreateService().ExplainPriceAsync(1, ct: TestContext.Current.CancellationToken);

        Assert.Equal("emit_price_explanation", _capturedForcedTool);
        Assert.Equal(AiTaskClass.Judgment, _capturedTaskClass);
        Assert.Contains("Base rate: 100.00", _capturedUserMessage);
        Assert.Contains("Waiting time: 45.50", _capturedUserMessage);
        Assert.Contains("Total: 145.50", _capturedUserMessage);
        Assert.Equal(2, result.Lines.Count);
        Assert.Equal(45.5m, result.Lines[1].Amount);
        Assert.Equal("Waiting time", Assert.Single(result.QueryRisks).Component);
    }

    [Fact]
    public async Task ExplainPriceAsync_UsTenant_UsesTheUsCurrencyExample()
    {
        _tenantInfo.IsUsTenant().Returns(true);
        _jobRepository.GetJobPriceBreakdownAsync(1, false).Returns([
            new ChargeViewModel { ChargeId = 1, Name = "Base rate", Amount = 100m }
        ]);
        StubToolResponse("emit_price_explanation", new
        {
            headline = "$100", lines = Array.Empty<object>(),
            queryRisks = Array.Empty<object>(), caveats = Array.Empty<string>()
        });

        await CreateService().ExplainPriceAsync(1, ct: TestContext.Current.CancellationToken);

        Assert.Contains("US-based", _capturedSystemPrompt);
        Assert.DoesNotContain("NZD", _capturedSystemPrompt);
    }

    [Fact]
    public async Task ExplainPriceAsync_TruncatedAnswer_ReportsItRatherThanThrowing()
    {
        _jobRepository.GetJobPriceBreakdownAsync(1, false).Returns([
            new ChargeViewModel { ChargeId = 1, Name = "Base rate", Amount = 100m }
        ]);
        _aiClient.SendMessageAsync(
                Arg.Any<AiTaskClass>(), Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<bool>(),
                Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { InputTokens = 5, OutputTokens = 0, StopReason = "max_tokens" });

        var result = await CreateService().ExplainPriceAsync(1, ct: TestContext.Current.CancellationToken);

        Assert.Contains("could not explain", result.Headline);
        Assert.Empty(result.Lines);
    }
}
