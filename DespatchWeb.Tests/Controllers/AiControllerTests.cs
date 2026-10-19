using DespatchWeb.Controllers;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(AiController))]
public class AiControllerTests
{
    private readonly IAiRateLimiter _rateLimiter = Substitute.For<IAiRateLimiter>();
    private readonly IAiSummarizationService _summarizationService = Substitute.For<IAiSummarizationService>();
    private readonly IAiDraftingService _draftingService = Substitute.For<IAiDraftingService>();
    private readonly IAiInsightsService _insightsService = Substitute.For<IAiInsightsService>();
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly IAiAuditLog _audit = Substitute.For<IAiAuditLog>();

    public AiControllerTests()
    {
        _tenantInfo.GetStaffId().Returns(1);
        _tenantInfo.GetTenantTimeZone().Returns("Pacific/Auckland");

        _rateLimiter
            .TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>())
            .Returns(true);

        _rateLimiter
            .RecordTokenUsageAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(),
                Arg.Any<AiTaskClass>(), Arg.Any<AiUsageInfo>())
            .Returns(Task.CompletedTask);
    }

    private AiController CreateController() => new(
        _summarizationService,
        _draftingService,
        _insightsService,
        _rateLimiter,
        _tenantInfo,
        _audit);

    [Fact]
    public async Task SummarizeJobNotes_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobNotes_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeJobNotesAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Job had two pickups.",
            Usage = new AiUsageInfo { InputTokens = 80, OutputTokens = 15 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeJobEvents_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeJobEventsAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Late alert resolved.",
            Usage = new AiUsageInfo { InputTokens = 60, OutputTokens = 10 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeJobEvents(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeJobEvents_ServiceThrows_Returns500()
    {
        _summarizationService.SummarizeJobEventsAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("DB error"));

        var controller = CreateController();

        var result = await controller.SummarizeJobEvents(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeTaskDashboardAsync(Arg.Any<CancellationToken>()).Returns(
            new StructuredSummaryResponse
            {
                Verdict = "3 overdue tasks need attention.",
                Usage = new AiUsageInfo { InputTokens = 150, OutputTokens = 30 }
            });

        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_ValidRequest_RecordsTokenUsage()
    {
        _summarizationService.SummarizeTaskDashboardAsync(Arg.Any<CancellationToken>()).Returns(
            new StructuredSummaryResponse
            {
                Verdict = "Summary",
                Usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 25 }
            });

        var controller = CreateController();

        await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", "SummarizeTaskDashboard", AiTaskClass.Judgment,
                Arg.Is<AiUsageInfo>(u => u.InputTokens == 100 && u.OutputTokens == 25));
    }

    [Fact]
    public async Task SummarizeTaskDashboard_ServiceThrows_Returns500()
    {
        _summarizationService.SummarizeTaskDashboardAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("DB error"));

        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_Cancelled_Returns499()
    {
        _summarizationService.SummarizeTaskDashboardAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJob_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SummarizeJob(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJob_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeJobAsync(1, Arg.Any<CancellationToken>()).Returns(new StructuredSummaryResponse
        {
            Verdict = "Job picked up on time and delivered.",
            Usage = new AiUsageInfo { InputTokens = 200, OutputTokens = 35 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeJob(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeJob_ServiceThrows_Returns500()
    {
        _summarizationService.SummarizeJobAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SummarizeJob(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeOperations_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeOperations_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeOperationsAsync(Arg.Any<CancellationToken>()).Returns(new StructuredSummaryResponse
        {
            Verdict = "15 active, 8 inactive.",
            Usage = new AiUsageInfo { InputTokens = 80, OutputTokens = 20 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeOperations_ValidRequest_RecordsTokenUsage()
    {
        _summarizationService.SummarizeOperationsAsync(Arg.Any<CancellationToken>()).Returns(new StructuredSummaryResponse
        {
            Verdict = "OK",
            Usage = new AiUsageInfo { InputTokens = 90, OutputTokens = 15 }
        });

        var controller = CreateController();

        await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", "SummarizeOperations", AiTaskClass.Judgment,
                Arg.Is<AiUsageInfo>(u => u.InputTokens == 90 && u.OutputTokens == 15));
    }

    [Fact]
    public async Task SummarizeOperations_ServiceThrows_Returns500()
    {
        _summarizationService.SummarizeOperationsAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeCompliance_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeCompliance_ValidRequest_ReturnsJson()
    {
        _summarizationService.SummarizeComplianceAsync(Arg.Any<CancellationToken>()).Returns(new StructuredSummaryResponse
        {
            Verdict = "3 expired licenses.",
            Usage = new AiUsageInfo { InputTokens = 120, OutputTokens = 20 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeCompliance_ServiceThrows_Returns500()
    {
        _summarizationService.SummarizeComplianceAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeCompliance_Cancelled_Returns499()
    {
        _summarizationService.SummarizeComplianceAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }

    [Fact]
    public async Task DraftMessage_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.DraftMessage(new DraftMessageRequest(), TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task DraftMessage_ValidRequest_ReturnsJsonAndRecordsUsage()
    {
        _draftingService.DraftCourierMessageAsync(Arg.Any<DraftMessageRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiDraftResponse
            {
                Draft = "Hi Dave, the pickup is running 30 minutes late.",
                Usage = new AiUsageInfo { InputTokens = 70, OutputTokens = 18 }
            });

        var controller = CreateController();

        var result = await controller.DraftMessage(new DraftMessageRequest(), TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
        await _rateLimiter.Received(1).RecordTokenUsageAsync(
            1, "Pacific/Auckland", "DraftMessage", AiTaskClass.Drafting,
            Arg.Is<AiUsageInfo>(u => u.InputTokens == 70 && u.OutputTokens == 18));
    }

    [Fact]
    public async Task DraftMessage_Cancelled_Returns499()
    {
        _draftingService.DraftCourierMessageAsync(Arg.Any<DraftMessageRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.DraftMessage(new DraftMessageRequest(), TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }

    [Fact]
    public async Task DraftMessage_ServiceThrows_Returns500()
    {
        _draftingService.DraftCourierMessageAsync(Arg.Any<DraftMessageRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("AI error"));

        var controller = CreateController();

        var result = await controller.DraftMessage(new DraftMessageRequest(), TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task DraftEmail_ValidRequest_ReturnsJson()
    {
        _draftingService.DraftEmailAsync(Arg.Any<DraftEmailRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiEmailDraftResponse
            {
                Subject = "Schedule change",
                Body = "Hi team, please note the schedule change.",
                Usage = new AiUsageInfo { InputTokens = 60, OutputTokens = 22 }
            });

        var controller = CreateController();

        var result = await controller.DraftEmail(new DraftEmailRequest(), TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task DraftPodEmail_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.DraftPodEmail(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task DraftPodEmail_ValidRequest_ReturnsJson()
    {
        _draftingService.DraftPodEmailAsync(1, Arg.Any<CancellationToken>())
            .Returns(new AiEmailDraftResponse
            {
                Subject = "Proof of Delivery - J12345",
                Body = "Your shipment was delivered.",
                Usage = new AiUsageInfo { InputTokens = 110, OutputTokens = 40 }
            });

        var controller = CreateController();

        var result = await controller.DraftPodEmail(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task DraftNote_ValidRequest_ReturnsJson()
    {
        _draftingService.DraftNoteAsync(Arg.Any<DraftNoteRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiDraftResponse
            {
                Draft = "Customer requested a call before delivery.",
                Usage = new AiUsageInfo { InputTokens = 50, OutputTokens = 12 }
            });

        var controller = CreateController();

        var result = await controller.DraftNote(new DraftNoteRequest(), TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task DraftNote_ServiceThrows_Returns500()
    {
        _draftingService.DraftNoteAsync(Arg.Any<DraftNoteRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("AI error"));

        var controller = CreateController();

        var result = await controller.DraftNote(new DraftNoteRequest(), TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task ExtractBlockers_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.ExtractBlockers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task ExtractBlockers_ValidRequest_ReturnsJsonAndRecordsUsage()
    {
        _insightsService.ExtractBlockersAsync(1, Arg.Any<CancellationToken>())
            .Returns(new ExtractBlockersResponse
            {
                Summary = "2 blockers",
                Severity = SummarySeverity.Caution,
                Usage = new AiUsageInfo { InputTokens = 90, OutputTokens = 25 }
            });

        var controller = CreateController();

        var result = await controller.ExtractBlockers(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
        await _rateLimiter.Received(1).RecordTokenUsageAsync(
            1, "Pacific/Auckland", "ExtractBlockers", AiTaskClass.Judgment,
            Arg.Is<AiUsageInfo>(u => u.InputTokens == 90 && u.OutputTokens == 25));
    }

    [Fact]
    public async Task AnalyzePricing_ValidRequest_ReturnsJson()
    {
        _insightsService.AnalyzePricingAsync(1, 5, Arg.Any<CancellationToken>())
            .Returns(new PricingAnalysisResponse
            {
                Anomaly = new PricingAnomaly { StoredCharge = 95, RecomputedRate = 145, DeltaPercent = -34.5m, IsOutlier = true },
                Usage = new AiUsageInfo { InputTokens = 120, OutputTokens = 30 }
            });

        var controller = CreateController();

        var result = await controller.AnalyzePricing(1, 5, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task AnalyzePricing_ServiceThrows_Returns500()
    {
        _insightsService.AnalyzePricingAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("AI error"));

        var controller = CreateController();

        var result = await controller.AnalyzePricing(1, 5, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task TriageChangeRequest_ValidRequest_ReturnsJson()
    {
        _insightsService.TriageChangeRequestAsync(42, 1, Arg.Any<CancellationToken>())
            .Returns(new ChangeRequestTriageResponse
            {
                RecommendedAction = "approve",
                Confidence = 0.8,
                Rationale = "Reasonable rate change.",
                Usage = new AiUsageInfo { InputTokens = 70, OutputTokens = 20 }
            });

        var controller = CreateController();

        var result = await controller.TriageChangeRequest(42, 1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task TriageChangeRequest_Cancelled_Returns499()
    {
        _insightsService.TriageChangeRequestAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.TriageChangeRequest(42, 1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobNotes_AiUnavailable_Returns503()
    {
        _summarizationService.SummarizeJobNotesAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new AiUnavailableException("timed out"));

        var result = await CreateController().SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        Assert.Equal(503, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task AnalyzePricing_ValidRequest_AuditsTheSuggestion()
    {
        var response = new PricingAnalysisResponse { Usage = new AiUsageInfo() };
        _insightsService.AnalyzePricingAsync(1, 5, Arg.Any<CancellationToken>()).Returns(response);

        await CreateController().AnalyzePricing(1, 5, TestContext.Current.CancellationToken);

        _audit.Received(1).Suggested("AnalyzePricing", 1, 1, "Pacific/Auckland", response);
    }

    [Fact]
    public async Task TriageChangeRequest_ValidRequest_AuditsTheRecommendation()
    {
        _insightsService.TriageChangeRequestAsync(42, 1, Arg.Any<CancellationToken>())
            .Returns(new ChangeRequestTriageResponse { RecommendedAction = "clarify", Usage = new AiUsageInfo() });

        await CreateController().TriageChangeRequest(42, 1, TestContext.Current.CancellationToken);

        _audit.Received(1).Suggested(
            "TriageChangeRequest", 1, 1, "Pacific/Auckland", Arg.Any<object>());
    }

    [Fact]
    public void RecordPricingOutcome_AuditsWhichSuggestedChargesWereAccepted()
    {
        var result = CreateController().RecordPricingOutcome(new AiPricingOutcomeRequest
        {
            JobId = 1,
            SuggestedChargeIds = [5, 6],
            AcceptedChargeIds = [5]
        });

        Assert.IsType<JsonResult>(result);
        _audit.Received(1).Decided("AnalyzePricing", 1, 1, "Pacific/Auckland", Arg.Is<IReadOnlyList<int>>(l => l.SequenceEqual(new[] { 5, 6 })), Arg.Is<IReadOnlyList<int>>(l => l.SequenceEqual(new[] { 5 })));
    }

    [Fact]
    public async Task DraftPodEmail_JobNotFound_Returns404WithoutADraft()
    {
        _draftingService.DraftPodEmailAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new JobNotFoundException("Job 9 was not found."));

        var result = await CreateController().DraftPodEmail(9, TestContext.Current.CancellationToken);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(404, status.StatusCode);
        Assert.Equal("Job 9 was not found.", status.Value);
    }

    [Fact]
    public void RecordPricingOutcome_DropsAcceptedIdsThatWereNeverSuggested()
    {
        CreateController().RecordPricingOutcome(new AiPricingOutcomeRequest
        {
            JobId = 1,
            SuggestedChargeIds = [5],
            AcceptedChargeIds = [5, 99]
        });

        _audit.Received(1).Decided(
            "AnalyzePricing", 1, 1, "Pacific/Auckland",
            Arg.Any<IReadOnlyList<int>>(),
            Arg.Is<IReadOnlyList<int>>(l => l.SequenceEqual(new[] { 5 })));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-3, 1)]
    [InlineData(1, 51)]
    public void RecordPricingOutcome_RejectsAnInvalidJobIdOrOversizedList_WithoutAuditing(int jobId, int idCount)
    {
        var result = CreateController().RecordPricingOutcome(new AiPricingOutcomeRequest
        {
            JobId = jobId,
            SuggestedChargeIds = Enumerable.Range(1, idCount).ToList()
        });

        Assert.IsType<BadRequestObjectResult>(result);
        _audit.DidNotReceiveWithAnyArgs().Decided(default!, default, default, default!, default!, default!);
    }
}
