using DespatchWeb.Controllers;
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
        _tenantInfo);

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
}
