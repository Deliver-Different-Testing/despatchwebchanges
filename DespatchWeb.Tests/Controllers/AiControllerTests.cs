using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class AiControllerTests
{
    private readonly Mock<IAiAssistantService> _assistantServiceMock = new();
    private readonly Mock<IAiSummarizationService> _summarizationServiceMock = new();
    private readonly Mock<IAiRateLimiter> _rateLimiterMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoMock = new();
    private readonly AnthropicSettings _settingsValue = new() { EnableAiFeatures = true };

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

    private AiController CreateController() => new(
        _assistantServiceMock.Object,
        _summarizationServiceMock.Object,
        _rateLimiterMock.Object,
        _tenantInfoMock.Object,
        Options.Create(_settingsValue));

    #region Chat

    [Fact]
    public async Task Chat_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        _settingsValue.EnableAiFeatures = false;
        var controller = CreateController();
        var request = CreateValidChatRequest();

        // Act
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult.Should().NotBeNull();
        statusResult!.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task Chat_InvalidRequest_Returns400()
    {
        // Arrange
        var controller = CreateController();
        var request = new AiChatRequest { Messages = [] };

        // Act
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        var badRequest = result as BadRequestObjectResult;
        badRequest.Should().NotBeNull();
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
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult.Should().NotBeNull();
        statusResult!.StatusCode.Should().Be(429);
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
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<JsonResult>();
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
        await controller.Chat(request, CancellationToken.None);

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
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult.Should().NotBeNull();
        statusResult!.StatusCode.Should().Be(500);
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
        var result = await controller.Chat(request, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult.Should().NotBeNull();
        statusResult!.StatusCode.Should().Be(499);
    }

    #endregion

    #region SummarizeJobNotes

    [Fact]
    public async Task SummarizeJobNotes_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        _settingsValue.EnableAiFeatures = false;
        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobNotes(1, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult!.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task SummarizeJobNotes_RateLimited_Returns429()
    {
        // Arrange
        _rateLimiterMock.Setup(x => x.TryAcquireAsync(It.IsAny<int>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobNotes(1, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult!.StatusCode.Should().Be(429);
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
        var result = await controller.SummarizeJobNotes(1, CancellationToken.None);

        // Assert
        result.Should().BeOfType<JsonResult>();
    }

    #endregion

    #region SummarizeJobEvents

    [Fact]
    public async Task SummarizeJobEvents_AiFeaturesDisabled_Returns503()
    {
        // Arrange
        _settingsValue.EnableAiFeatures = false;
        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobEvents(1, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult!.StatusCode.Should().Be(503);
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
        var result = await controller.SummarizeJobEvents(1, CancellationToken.None);

        // Assert
        result.Should().BeOfType<JsonResult>();
    }

    [Fact]
    public async Task SummarizeJobEvents_ServiceThrows_Returns500()
    {
        // Arrange
        _summarizationServiceMock.Setup(x => x.SummarizeJobEventsAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var controller = CreateController();

        // Act
        var result = await controller.SummarizeJobEvents(1, CancellationToken.None);

        // Assert
        var statusResult = result as ObjectResult;
        statusResult!.StatusCode.Should().Be(500);
    }

    #endregion

    #region Helper Methods

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

    #endregion
}
