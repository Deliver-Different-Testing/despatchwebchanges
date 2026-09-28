using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Models.Ai;
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
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        Judgment = new AiModelProfile { Model = "claude-sonnet-5", Effort = "low", MaxTokens = 1024 }
    });
    private static readonly string[] StringArray = ["3% below rate card"];

    private AiInsightsService CreateService() => new(
        _aiClient, _noteRepository, _jobRepository, _accessorialService,
        _rateJobService, _changeRequestService, _tenantInfo, _settings);

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
            .Returns(response);
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
}
