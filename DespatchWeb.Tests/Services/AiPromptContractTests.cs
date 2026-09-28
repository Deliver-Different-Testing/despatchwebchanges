using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Accessorial;
using DespatchWeb.Models.Ai;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Guards the prompt surface itself. Every system prompt and tool description is an
/// inline literal, so nothing else stops a rule from being dropped, duplicated, or
/// re-inflated with steering language the API already enforces.
/// </summary>
public class AiPromptContractTests
{
    private readonly IAccessorialChargeService _accessorialService = Substitute.For<IAccessorialChargeService>();
    private readonly IAiClientService _aiClient = Substitute.For<IAiClientService>();
    private readonly IJobChangeRequestService _changeRequestService = Substitute.For<IJobChangeRequestService>();
    private readonly ICourierRepository _courierRepository = Substitute.For<ICourierRepository>();
    private readonly IJobQueryRepository _jobRepository = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _noteRepository = Substitute.For<INoteRepository>();
    private readonly IRateJobService _rateJobService = Substitute.For<IRateJobService>();
    private readonly ITaskRepository _taskRepository = Substitute.For<ITaskRepository>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings());

    private readonly List<string> _systemPrompts = [];
    private readonly List<AiToolDefinition> _tools = [];

    public AiPromptContractTests()
    {
        _aiClient.SendMessageAsync(
                Arg.Any<AiTaskClass>(), Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<string>(),
                Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                _systemPrompts.Add(call.ArgAt<string>(1));
                _tools.AddRange(call.ArgAt<List<AiToolDefinition>>(4) ?? []);
                return new AiClientResponse { TextContent = "ok" };
            });

        _jobRepository.GetSingleJobById(Arg.Any<int>()).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active", From = "A", ToAddress = "B"
        });
        _noteRepository.GetNotesByJobIdAsync(Arg.Any<int>()).Returns([
            new TucNoteViewModel { NoteText = "call before delivery", NoteTypeName = "Delivery" }
        ]);
        _taskRepository.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).Returns([]);
        _courierRepository.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns([new CourierComplianceViewModel { Name = "Dave", Code = "D1", ExpiryDate = DateTime.UtcNow.AddDays(-1) }]);
        _jobRepository.GetOverviewStatsAsync().Returns(new OverviewStatsViewModel { Active = 5, Inactive = 1, Completed = 2 });
        _changeRequestService.ListForJobAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<JobChangeRequestDto> { new() { Id = 1, JobId = 1, FieldName = "Charge" } });
        _accessorialService.GetAvailableChargesAsync(Arg.Any<int>(), Arg.Any<int>())
            .Returns(new List<AccessorialChargeDto>
            {
                new() { AccessorialChargeId = 7, Name = "Waiting time", ChargeType = "PerUnit" }
            });
    }

    private AiSummarizationService Summarization() => new(
        _aiClient, _noteRepository, _taskRepository, _jobRepository, _courierRepository, _tenantInfo, _settings);

    private AiDraftingService Drafting() => new(
        _aiClient, _jobRepository, _noteRepository, _tenantInfo, _settings);

    private AiInsightsService Insights() => new(
        _aiClient, _noteRepository, _jobRepository, _accessorialService, _rateJobService,
        _changeRequestService, _tenantInfo, _settings);

    private async Task CaptureEveryPromptAsync()
    {
        var ct = TestContext.Current.CancellationToken;
        var s = Summarization();
        await s.SummarizeJobNotesAsync(1, ct);
        await s.SummarizeJobEventsAsync(1, ct);
        await s.SummarizeJobAsync(1, ct);
        await s.SummarizeOperationsAsync(ct);
        await s.SummarizeComplianceAsync(ct);

        var d = Drafting();
        await d.DraftCourierMessageAsync(new DraftMessageRequest { Seed = "hi" }, ct);
        await d.DraftEmailAsync(new DraftEmailRequest { SeedSubject = "s", SeedBody = "b" }, ct);
        await d.DraftPodEmailAsync(1, ct);
        await d.DraftNoteAsync(new DraftNoteRequest { Seed = "n", NoteTypeId = (int)NoteType.ClientNote }, ct);

        await Insights().ExtractBlockersAsync(1, ct);
        await Insights().TriageChangeRequestAsync(1, 1, ct);
        await Insights().AnalyzePricingAsync(1, 5, ct);

        await s.SummarizeTaskDashboardAsync(ct);
    }

    [Fact]
    public async Task NoPromptRestatesAToolChoiceTheApiAlreadyForces()
    {
        await CaptureEveryPromptAsync();

        Assert.NotEmpty(_systemPrompts);
        foreach (var prompt in _systemPrompts)
        {
            // Every tool-bearing call passes forceToolName, which becomes
            // tool_choice: {type: "tool"} — the API guarantees the call. Repeating it as
            // an emphatic instruction only pushes the model toward over-triggering.
            Assert.DoesNotContain("MUST call", prompt, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("You MUST", prompt, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task NoPromptDefersToAnotherPromptTheModelNeverSees()
    {
        await CaptureEveryPromptAsync();

        foreach (var prompt in _systemPrompts)
        {
            // Each system prompt is its own request. "Rules: same as the job briefing"
            // silently drops the no-fabrication and trust-SIGNAL rules from that call.
            Assert.DoesNotContain("Rules: same", prompt, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("same as the job briefing", prompt, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Theory]
    [InlineData("job")]
    [InlineData("operations")]
    [InlineData("compliance")]
    [InlineData("taskdashboard")]
    public async Task EveryStructuredBriefingCarriesTheSharedRules(string briefing)
    {
        var ct = TestContext.Current.CancellationToken;
        var s = Summarization();
        switch (briefing)
        {
            case "job": await s.SummarizeJobAsync(1, ct); break;
            case "operations": await s.SummarizeOperationsAsync(ct); break;
            case "compliance": await s.SummarizeComplianceAsync(ct); break;
            default:
                _taskRepository.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
                    .Returns([new TaskViewModel { JobNumber = "J1", DueDate = DateTimeOffset.UtcNow.AddHours(-2) }]);
                await s.SummarizeTaskDashboardAsync(ct);
                break;
        }

        var prompt = Assert.Single(_systemPrompts);
        Assert.Contains("source of truth", prompt);
        Assert.Contains("[PHONE]", prompt);
        Assert.Contains("Never state a fact the data does not contain", prompt);
    }

    [Fact]
    public async Task NoPromptBansAVerbAnotherPromptUsesAsAGoodExample()
    {
        await CaptureEveryPromptAsync();

        var all = string.Join("\n", _systemPrompts);
        Assert.DoesNotContain("Banned vague phrasing", all, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EveryToolDescriptionCarriesItsContract()
    {
        await CaptureEveryPromptAsync();

        // All four forced-output tools must be exercised, or this guard is vacuous.
        Assert.Equal(
            ["emit_accessorial_suggestions", "emit_blockers", "emit_email_draft", "emit_summary", "emit_triage"],
            _tools.Select(t => t.Name).Distinct().Order());

        foreach (var tool in _tools.DistinctBy(t => t.Name))
        {
            Assert.False(string.IsNullOrWhiteSpace(tool.Description), $"{tool.Name} has no description");
            // A tool description is the strongest lever on tool-call quality, and the
            // usual failure is under-description. A one-liner is not a contract.
            Assert.True(tool.Description.Length > 250,
                $"{tool.Name} description is {tool.Description.Length} chars: too thin to state its contract");
            Assert.DoesNotContain("Emit the structured result for", tool.Description);
        }
    }

    [Fact]
    public async Task EveryToolDescriptionNamesTheFieldsItsSchemaRequires()
    {
        await CaptureEveryPromptAsync();

        var byName = _tools.DistinctBy(t => t.Name).ToDictionary(t => t.Name, t => t.Description);

        Assert.Contains("evidence", byName["emit_blockers"]);
        Assert.Contains("actionRequired", byName["emit_blockers"]);
        Assert.Contains("recommendedAction", byName["emit_triage"]);
        // The approver, not the model, owns the decision — the description has to say so.
        Assert.Contains("human approver", byName["emit_triage"]);
        Assert.Contains("subject", byName["emit_email_draft"]);
        Assert.Contains("body", byName["emit_email_draft"]);
        // The catalog constraint is the one that stops a hallucinated charge id, and the
        // post-filter that enforces it is invisible to the model.
        Assert.Contains("catalog", byName["emit_accessorial_suggestions"]);
        Assert.Contains("accessorialChargeId", byName["emit_accessorial_suggestions"]);
    }
}
