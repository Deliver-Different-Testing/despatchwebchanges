using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class AiControllerTests
{
    private readonly IAiAssistantService _assistantService = Substitute.For<IAiAssistantService>();
    private readonly IAiRateLimiter _rateLimiter = Substitute.For<IAiRateLimiter>();
    private readonly AnthropicSettings _settingsValue = new() { EnableAiFeatures = true };
    private readonly IAiSummarizationService _summarizationService = Substitute.For<IAiSummarizationService>();
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
                Arg.Any<int>(),
                Arg.Any<string>(),
                Arg.Any<int>(),
                Arg.Any<int>())
            .Returns(Task.CompletedTask);
    }

    private AiController CreateController(AnthropicSettings? settings = null) => new(
        _assistantService,
        _summarizationService,
        _rateLimiter,
        _tenantInfo,
        Options.Create(settings ?? _settingsValue));

    private static AiChatRequest CreateValidChatRequest() =>
        new()
        {
            Messages =
            [
                new AiChatMessage { Role = "user", Content = "How many active jobs?" }
            ]
        };

    [Fact]
    public void IsEnabled_WhenFeaturesEnabled_ReturnsEnabledTrue()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = true });

        var result = controller.IsEnabled();

        var json = result as JsonResult;
        Assert.NotNull(json);
        dynamic? value = json.Value;
        Assert.True((bool)value!.enabled);
    }

    [Fact]
    public void IsEnabled_WhenFeaturesDisabled_ReturnsEnabledFalse()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = controller.IsEnabled();

        var json = result as JsonResult;
        Assert.NotNull(json);
        dynamic? value = json.Value;
        Assert.False((bool)value!.enabled);
    }

    [Fact]
    public async Task Chat_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.NotNull(statusResult);
        Assert.Equal(503, statusResult.StatusCode);
    }

    [Fact]
    public async Task Chat_InvalidRequest_Returns400()
    {
        // Arrange
        var controller = CreateController();
        var request = new AiChatRequest { Messages = [] };

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        var badRequest = result as BadRequestObjectResult;
        Assert.NotNull(badRequest);
    }

    [Fact]
    public async Task Chat_RateLimitExceeded_Returns429()
    {
        // Arrange
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>())
            .Returns(false);

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.NotNull(statusResult);
        Assert.Equal(429, statusResult.StatusCode);
    }

    [Fact]
    public async Task Chat_ValidRequest_ReturnsJsonResponse()
    {
        // Arrange
        _assistantService.ChatAsync(Arg.Any<List<AiMessage>>(), Arg.Any<CancellationToken>())
            .Returns(new AiChatResponse
            {
                Message = "There are 5 active jobs.",
                Usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 20 }
            });

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Chat_ValidRequest_RecordsTokenUsage()
    {
        // Arrange
        _assistantService.ChatAsync(Arg.Any<List<AiMessage>>(), Arg.Any<CancellationToken>()).Returns(
            new AiChatResponse
            {
                Message = "OK",
                Usage = new AiUsageInfo { InputTokens = 200, OutputTokens = 50 }
            });

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", 200, 50);
    }

    [Fact]
    public async Task Chat_ServiceThrows_Returns500()
    {
        // Arrange
        _assistantService.ChatAsync(Arg.Any<List<AiMessage>>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Service error"));

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.NotNull(statusResult);
        Assert.Equal(500, statusResult.StatusCode);
    }

    [Fact]
    public async Task Chat_Cancelled_Returns499()
    {
        // Arrange
        _assistantService.ChatAsync(Arg.Any<List<AiMessage>>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.NotNull(statusResult);
        Assert.Equal(499, statusResult.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobNotes_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        // Act
        var result = await controller.SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobNotes_RateLimited_Returns429()
    {
        // Arrange
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobNotes_ValidRequest_ReturnsJson()
    {
        // Arrange
        _summarizationService.SummarizeJobNotesAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Job had two pickups.",
            Usage = new AiUsageInfo { InputTokens = 80, OutputTokens = 15 }
        });

        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobNotes(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeJobEvents_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        // Act
        var result = await controller.SummarizeJobEvents(1, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJobEvents_ValidRequest_ReturnsJson()
    {
        // Arrange
        _summarizationService.SummarizeJobEventsAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Late alert resolved.",
            Usage = new AiUsageInfo { InputTokens = 60, OutputTokens = 10 }
        });

        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobEvents(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeJobEvents_ServiceThrows_Returns500()
    {
        // Arrange
        _summarizationService.SummarizeJobEventsAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("DB error"));

        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobEvents(1, TestContext.Current.CancellationToken);

        // Assert
        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
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
            new AiSummaryResponse
            {
                Summary = "3 overdue tasks need attention.",
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
            new AiSummaryResponse
            {
                Summary = "Summary",
                Usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 25 }
            });

        var controller = CreateController();

        await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", 100, 25);
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
    public async Task SummarizeJob_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.SummarizeJob(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
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
        _summarizationService.SummarizeJobAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Job picked up on time and delivered.",
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
    public async Task SummarizeOperations_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
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
        _summarizationService.SummarizeOperationsAsync(Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "15 active, 8 inactive.",
            Usage = new AiUsageInfo { InputTokens = 80, OutputTokens = 20 }
        });

        var controller = CreateController();

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SummarizeOperations_ValidRequest_RecordsTokenUsage()
    {
        _summarizationService.SummarizeOperationsAsync(Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "OK",
            Usage = new AiUsageInfo { InputTokens = 90, OutputTokens = 15 }
        });

        var controller = CreateController();

        await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", 90, 15);
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
    public async Task SummarizeCompliance_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
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
        _summarizationService.SummarizeComplianceAsync(Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "3 expired licenses.",
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
    public async Task AnalyzeLateAlert_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
    }

    [Fact]
    public async Task AnalyzeLateAlert_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task AnalyzeLateAlert_ValidRequest_ReturnsJson()
    {
        _summarizationService.AnalyzeLateAlertAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Recommend: Monitor the situation.",
            Usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 20 }
        });

        var controller = CreateController();

        var result = await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task AnalyzeLateAlert_ValidRequest_RecordsTokenUsage()
    {
        _summarizationService.AnalyzeLateAlertAsync(1, Arg.Any<CancellationToken>()).Returns(new AiSummaryResponse
        {
            Summary = "Analysis",
            Usage = new AiUsageInfo { InputTokens = 110, OutputTokens = 22 }
        });

        var controller = CreateController();

        await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        await _rateLimiter.Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", 110, 22);
    }

    [Fact]
    public async Task AnalyzeLateAlert_ServiceThrows_Returns500()
    {
        _summarizationService.AnalyzeLateAlertAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_AiFeaturesDisabled_Returns503()
    {
        var controller = CreateController(new AnthropicSettings { EnableAiFeatures = false });

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(503, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_RateLimited_Returns429()
    {
        _rateLimiter.TryAcquireAsync(Arg.Any<int>(), Arg.Any<string>()).Returns(false);
        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_ValidRequest_ReturnsJson()
    {
        _summarizationService.SuggestCouriersAsync(1, Arg.Any<CancellationToken>()).Returns(
            new AiCourierSuggestionResponse
            {
                Summary = "1. John - closest. 2. Jane - lowest load.",
                Usage = new AiUsageInfo { InputTokens = 200, OutputTokens = 40 },
                Couriers =
                [
                    new SuggestedCourier { CourierId = 10, Code = "C10", FirstName = "John" },
                    new SuggestedCourier { CourierId = 11, Code = "C11", FirstName = "Jane" }
                ]
            });

        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task SuggestCouriers_ValidRequest_RecordsTokenUsage()
    {
        _summarizationService.SuggestCouriersAsync(1, Arg.Any<CancellationToken>()).Returns(
            new AiCourierSuggestionResponse
            {
                Summary = "Suggestions",
                Usage = new AiUsageInfo { InputTokens = 250, OutputTokens = 45 }
            });

        var controller = CreateController();

        await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        await _rateLimiter
            .Received(1)
            .RecordTokenUsageAsync(1, "Pacific/Auckland", 250, 45);
    }

    [Fact]
    public async Task SuggestCouriers_ServiceThrows_Returns500()
    {
        _summarizationService.SuggestCouriersAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_Cancelled_Returns499()
    {
        _summarizationService.SuggestCouriersAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }
}