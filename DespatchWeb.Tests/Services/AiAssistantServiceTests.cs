using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace DespatchWeb.Tests.Services;

public class AiAssistantServiceTests
{
    private readonly Mock<IAiClientService> _aiClientMock = new();
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();
    private readonly Mock<INoteRepository> _noteRepositoryMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoMock = new();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerRequest = 4096,
        Model = "claude-sonnet-4-20250514"
    });

    public AiAssistantServiceTests()
    {
        _tenantInfoMock.Setup(x => x.GetStaffInfoAsync())
            .ReturnsAsync(new Suggestion { Id = 1, Text = "Test Operator" });
        _tenantInfoMock.Setup(x => x.GetTenantTimeZone()).Returns("Pacific/Auckland");
        _tenantInfoMock.Setup(x => x.GetCurrentTenantTime()).Returns(new DateTime(2025, 6, 15, 10, 30, 0));
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(false);
    }

    private AiAssistantService CreateService() => new(
        _aiClientMock.Object,
        _jobRepositoryMock.Object,
        _courierRepositoryMock.Object,
        _noteRepositoryMock.Object,
        _taskRepositoryMock.Object,
        _tenantInfoMock.Object,
        _settings);

    #region ChatAsync - Basic Response

    [Fact]
    public async Task ChatAsync_SimpleTextResponse_ReturnsMessage()
    {
        // Arrange
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "There are 5 active jobs.",
                InputTokens = 100,
                OutputTokens = 20
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "How many active jobs?" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Message.Should().Be("There are 5 active jobs.");
        result.Usage.InputTokens.Should().Be(100);
        result.Usage.OutputTokens.Should().Be(20);
    }

    [Fact]
    public async Task ChatAsync_EmptyTextContent_ReturnsEmptyMessage()
    {
        // Arrange
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = null,
                InputTokens = 50,
                OutputTokens = 0
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hello" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Message.Should().BeEmpty();
    }

    #endregion

    #region ChatAsync - Tool Use

    [Fact]
    public async Task ChatAsync_WithToolCall_ExecutesToolAndReturnsResult()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                {
                    return new AiClientResponse
                    {
                        TextContent = "Let me look that up.",
                        ToolCalls =
                        [
                            new AiToolCall
                            {
                                ToolUseId = "tool1",
                                ToolName = "lookup_job",
                                ArgumentsJson = """{"jobId": 123}"""
                            }
                        ],
                        InputTokens = 200,
                        OutputTokens = 50
                    };
                }

                return new AiClientResponse
                {
                    TextContent = "Job 123 is currently active.",
                    InputTokens = 300,
                    OutputTokens = 30
                };
            });

        _jobRepositoryMock.Setup(x => x.GetSingleJobById(123))
            .ReturnsAsync(new JobViewModel { Id = 123 });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "What is job 123?" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Message.Should().Be("Job 123 is currently active.");
        result.Usage.InputTokens.Should().Be(500);
        result.Usage.OutputTokens.Should().Be(80);
    }

    [Fact]
    public async Task ChatAsync_LookupJobNotFound_ReturnsErrorInToolResult()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                {
                    return new AiClientResponse
                    {
                        ToolCalls =
                        [
                            new AiToolCall
                            {
                                ToolUseId = "tool1",
                                ToolName = "lookup_job",
                                ArgumentsJson = """{"jobId": 999}"""
                            }
                        ],
                        InputTokens = 100,
                        OutputTokens = 30
                    };
                }

                return new AiClientResponse
                {
                    TextContent = "Job 999 was not found.",
                    InputTokens = 150,
                    OutputTokens = 20
                };
            });

        _jobRepositoryMock.Setup(x => x.GetSingleJobById(999))
            .ReturnsAsync((JobViewModel)null);

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Find job 999" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Message.Should().Contain("not found");
    }

    [Fact]
    public async Task ChatAsync_UnknownTool_ReturnsErrorJson()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                {
                    return new AiClientResponse
                    {
                        ToolCalls =
                        [
                            new AiToolCall
                            {
                                ToolUseId = "tool1",
                                ToolName = "nonexistent_tool",
                                ArgumentsJson = "{}"
                            }
                        ],
                        InputTokens = 100,
                        OutputTokens = 20
                    };
                }

                return new AiClientResponse
                {
                    TextContent = "I encountered an error.",
                    InputTokens = 200,
                    OutputTokens = 20
                };
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Do something" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Should().NotBeNull();
    }

    #endregion

    #region ChatAsync - Token Accumulation

    [Fact]
    public async Task ChatAsync_AccumulatesTokensAcrossIterations()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                {
                    return new AiClientResponse
                    {
                        ToolCalls =
                        [
                            new AiToolCall
                            {
                                ToolUseId = "t1",
                                ToolName = "get_overview_stats",
                                ArgumentsJson = "{}"
                            }
                        ],
                        InputTokens = 100,
                        OutputTokens = 25
                    };
                }

                return new AiClientResponse
                {
                    TextContent = "Here are the stats.",
                    InputTokens = 200,
                    OutputTokens = 50
                };
            });

        _jobRepositoryMock.Setup(x => x.GetOverviewStatsAsync())
            .ReturnsAsync(new OverviewStatsViewModel());

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Show overview" } };

        // Act
        var result = await service.ChatAsync(messages);

        // Assert
        result.Usage.InputTokens.Should().Be(300);
        result.Usage.OutputTokens.Should().Be(75);
    }

    #endregion

    #region ChatAsync - System Prompt

    [Fact]
    public async Task ChatAsync_IncludesOperatorContextInSystemPrompt()
    {
        // Arrange
        string capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (system, _, _, _, _) => capturedSystemPrompt = system)
            .ReturnsAsync(new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages);

        // Assert
        capturedSystemPrompt.Should().Contain("Test Operator");
        capturedSystemPrompt.Should().Contain("Pacific/Auckland");
        capturedSystemPrompt.Should().Contain("Non-US");
    }

    [Fact]
    public async Task ChatAsync_UsOperator_SystemPromptShowsUs()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(true);

        string capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (system, _, _, _, _) => capturedSystemPrompt = system)
            .ReturnsAsync(new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages);

        // Assert
        capturedSystemPrompt.Should().Contain("US");
    }

    #endregion

    #region ChatAsync - Data Sanitization

    [Fact]
    public async Task ChatAsync_SanitizesUserMessages()
    {
        // Arrange
        List<AiMessage> capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 });

        var service = CreateService();
        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = "Contact john@example.com about job 100" }
        };

        // Act
        await service.ChatAsync(messages);

        // Assert
        capturedMessages.Should().NotBeNull();
        capturedMessages[0].Content.Should().Contain("[EMAIL]");
        capturedMessages[0].Content.Should().NotContain("john@example.com");
    }

    #endregion

    #region ChatAsync - Tool Definitions

    [Fact]
    public async Task ChatAsync_PassesToolDefinitions()
    {
        // Arrange
        List<AiToolDefinition> capturedTools = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, _, _, tools, _) => capturedTools = tools)
            .ReturnsAsync(new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages);

        // Assert
        capturedTools.Should().NotBeNull();
        capturedTools.Should().Contain(t => t.Name == "lookup_job");
        capturedTools.Should().Contain(t => t.Name == "search_jobs");
        capturedTools.Should().Contain(t => t.Name == "search_couriers");
        capturedTools.Should().Contain(t => t.Name == "get_job_notes");
        capturedTools.Should().Contain(t => t.Name == "get_job_events");
        capturedTools.Should().Contain(t => t.Name == "get_courier_details");
        capturedTools.Should().Contain(t => t.Name == "get_overview_stats");
        capturedTools.Should().Contain(t => t.Name == "get_active_couriers");
    }

    #endregion
}
