using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class AiControllerTests
{
    private readonly Mock<IAiAssistantService> _assistantServiceMock = new();
    private readonly Mock<IAiRateLimiter> _rateLimiterMock = new();
    private readonly AnthropicSettings _settingsValue = new() { EnableAiFeatures = true };
    private readonly Mock<IAiSummarizationService> _summarizationServiceMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoMock = new();

    public AiControllerTests()
    {
        _tenantInfoMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoMock.Setup(x => x.GetTenantTimeZone()).Returns("Pacific/Auckland");
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        _rateLimiterMock.Setup(x => x.RecordTokenUsageAsync(
                It.IsAny<int>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
            .Returns(Task.CompletedTask);
    }

    private AiController CreateController(AnthropicSettings? settings = null) => new(
        _assistantServiceMock.Object,
        _summarizationServiceMock.Object,
        _rateLimiterMock.Object,
        _tenantInfoMock.Object,
        Options.Create(settings ?? _settingsValue));

    private static AiChatRequest CreateValidChatRequest()
    {
        return new AiChatRequest
        {
            Messages =
            [
                new AiChatMessage { Role = "user", Content = "How many active jobs?" }
            ]
        };
    }

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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
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
        _assistantServiceMock.Setup(x => x.ChatAsync(It.IsAny<List<AiMessage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiChatResponse
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
        _assistantServiceMock.Setup(x => x.ChatAsync(It.IsAny<List<AiMessage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiChatResponse
            {
                Message = "OK",
                Usage = new AiUsageInfo { InputTokens = 200, OutputTokens = 50 }
            });

        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        await controller.Chat(request, TestContext.Current.CancellationToken);

        // Assert
        _rateLimiterMock.Verify(x => x.RecordTokenUsageAsync(1, "Pacific/Auckland", 200, 50), Times.Once);
    }

    [Fact]
    public async Task Chat_ServiceThrows_Returns500()
    {
        // Arrange
        _assistantServiceMock.Setup(x => x.ChatAsync(It.IsAny<List<AiMessage>>(), It.IsAny<CancellationToken>()))
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
        _assistantServiceMock.Setup(x => x.ChatAsync(It.IsAny<List<AiMessage>>(), It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
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
        _summarizationServiceMock.Setup(x => x.SummarizeJobNotesAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeJobEventsAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeJobEventsAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeTaskDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeTaskDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
            {
                Summary = "Summary",
                Usage = new AiUsageInfo { InputTokens = 100, OutputTokens = 25 }
            });

        var controller = CreateController();

        await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        _rateLimiterMock.Verify(x => x.RecordTokenUsageAsync(1, "Pacific/Auckland", 100, 25), Times.Once);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_ServiceThrows_Returns500()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeTaskDashboardAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var controller = CreateController();

        var result = await controller.SummarizeTaskDashboard(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeTaskDashboard_Cancelled_Returns499()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeTaskDashboardAsync(It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.SummarizeJob(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeJob_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeJobAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeJobAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeOperations_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeOperationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeOperationsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
            {
                Summary = "OK",
                Usage = new AiUsageInfo { InputTokens = 90, OutputTokens = 15 }
            });

        var controller = CreateController();

        await controller.SummarizeOperations(TestContext.Current.CancellationToken);

        _rateLimiterMock.Verify(x => x.RecordTokenUsageAsync(1, "Pacific/Auckland", 90, 15), Times.Once);
    }

    [Fact]
    public async Task SummarizeOperations_ServiceThrows_Returns500()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeOperationsAsync(It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeCompliance_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeComplianceAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.SummarizeComplianceAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SummarizeCompliance(TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SummarizeCompliance_Cancelled_Returns499()
    {
        _summarizationServiceMock.Setup(x => x.SummarizeComplianceAsync(It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task AnalyzeLateAlert_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.AnalyzeLateAlertAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
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
        _summarizationServiceMock.Setup(x => x.AnalyzeLateAlertAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiSummaryResponse
            {
                Summary = "Analysis",
                Usage = new AiUsageInfo { InputTokens = 110, OutputTokens = 22 }
            });

        var controller = CreateController();

        await controller.AnalyzeLateAlert(1, TestContext.Current.CancellationToken);

        _rateLimiterMock.Verify(x => x.RecordTokenUsageAsync(1, "Pacific/Auckland", 110, 22), Times.Once);
    }

    [Fact]
    public async Task AnalyzeLateAlert_ServiceThrows_Returns500()
    {
        _summarizationServiceMock.Setup(x => x.AnalyzeLateAlertAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
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
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(429, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_ValidRequest_ReturnsJson()
    {
        _summarizationServiceMock.Setup(x => x.SuggestCouriersAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiCourierSuggestionResponse
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
        _summarizationServiceMock.Setup(x => x.SuggestCouriersAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiCourierSuggestionResponse
            {
                Summary = "Suggestions",
                Usage = new AiUsageInfo { InputTokens = 250, OutputTokens = 45 }
            });

        var controller = CreateController();

        await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        _rateLimiterMock.Verify(x => x.RecordTokenUsageAsync(1, "Pacific/Auckland", 250, 45), Times.Once);
    }

    [Fact]
    public async Task SuggestCouriers_ServiceThrows_Returns500()
    {
        _summarizationServiceMock.Setup(x => x.SuggestCouriersAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Error"));

        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(500, statusResult!.StatusCode);
    }

    [Fact]
    public async Task SuggestCouriers_Cancelled_Returns499()
    {
        _summarizationServiceMock.Setup(x => x.SuggestCouriersAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        var controller = CreateController();

        var result = await controller.SuggestCouriers(1, TestContext.Current.CancellationToken);

        var statusResult = result as ObjectResult;
        Assert.Equal(499, statusResult!.StatusCode);
    }

}