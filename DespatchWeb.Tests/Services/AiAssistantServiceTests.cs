using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiAssistantServiceTests
{
    private readonly IAiClientService _aiClientMock = Substitute.For<IAiClientService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly ICourierRepository _courierRepositoryMock = Substitute.For<ICourierRepository>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerRequest = 4096,
        Model = "claude-sonnet-4-20250514"
    });

    private readonly ITaskRepository _taskRepositoryMock = Substitute.For<ITaskRepository>();
    private readonly ITenantInfoService _tenantInfoMock = Substitute.For<ITenantInfoService>();

    public AiAssistantServiceTests()
    {
        _tenantInfoMock.GetStaffInfoAsync()
            .Returns(new Suggestion { Id = 1, Text = "Test Operator" });
        _tenantInfoMock.GetTenantTimeZone().Returns("Pacific/Auckland");
        _tenantInfoMock.IsUsTenant().Returns(false);
    }

    private AiAssistantService CreateService() => new(
        _aiClientMock,
        _jobRepositoryMock,
        _courierRepositoryMock,
        _noteRepositoryMock,
        _taskRepositoryMock,
        _tenantInfoMock,
        _clock,
        _settings);

    [Fact]
    public async Task ChatAsync_AccumulatesTokensAcrossIterations()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
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

        _jobRepositoryMock.GetOverviewStatsAsync()
            .Returns(new OverviewStatsViewModel());

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Show overview" } };

        // Act
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(300, result.Usage.InputTokens);
        Assert.Equal(75, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task ChatAsync_SanitizesUserMessages()
    {
        // Arrange
        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 };
            });

        var service = CreateService();
        var messages = new List<AiMessage>
        {
            new() { Role = "user", Content = "Contact john@example.com about job 100" }
        };

        // Act
        await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedMessages);
        Assert.Contains("[EMAIL]", capturedMessages[0].Content);
        Assert.DoesNotContain("john@example.com", capturedMessages[0].Content);
    }

    [Fact]
    public async Task ChatAsync_PassesToolDefinitions()
    {
        // Arrange
        List<AiToolDefinition>? capturedTools = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedTools = callInfo.ArgAt<List<AiToolDefinition>>(3);
                return new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 };
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedTools);
        Assert.Contains(capturedTools, t => t.Name == "lookup_job");
        Assert.Contains(capturedTools, t => t.Name == "search_jobs");
        Assert.Contains(capturedTools, t => t.Name == "search_couriers");
        Assert.Contains(capturedTools, t => t.Name == "get_job_notes");
        Assert.Contains(capturedTools, t => t.Name == "get_job_events");
        Assert.Contains(capturedTools, t => t.Name == "get_courier_details");
        Assert.Contains(capturedTools, t => t.Name == "get_overview_stats");
        Assert.Contains(capturedTools, t => t.Name == "get_active_couriers");
    }

    [Fact]
    public async Task ChatAsync_SimpleTextResponse_ReturnsMessage()
    {
        // Arrange
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "There are 5 active jobs.",
                InputTokens = 100,
                OutputTokens = 20
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "How many active jobs?" } };

        // Act
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("There are 5 active jobs.", result.Message);
        Assert.Equal(100, result.Usage.InputTokens);
        Assert.Equal(20, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task ChatAsync_EmptyTextContent_ReturnsEmptyMessage()
    {
        // Arrange
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = null,
                InputTokens = 50,
                OutputTokens = 0
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hello" } };

        // Act
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Empty(result.Message);
    }

    [Fact]
    public async Task ChatAsync_WithToolCall_ExecutesToolAndReturnsResult()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
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

        _jobRepositoryMock.GetSingleJobById(123)
            .Returns(new JobViewModel { Id = 123 });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "What is job 123?" } };

        // Act
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Job 123 is currently active.", result.Message);
        Assert.Equal(500, result.Usage.InputTokens);
        Assert.Equal(80, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task ChatAsync_LookupJobNotFound_ReturnsErrorInToolResult()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
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

        _jobRepositoryMock.GetSingleJobById(999)
            .Returns((JobViewModel?)null);

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Find job 999" } };

        // Act
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("not found", result.Message);
    }

    [Fact]
    public async Task ChatAsync_UnknownTool_ReturnsErrorJson()
    {
        // Arrange
        var callCount = 0;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                callCount++;
                if (callCount == 1)
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
        var result = await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
    }

    [Fact]
    public async Task ChatAsync_IncludesOperatorContextInSystemPrompt()
    {
        // Arrange
        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 };
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Test Operator", capturedSystemPrompt);
        Assert.Contains("Pacific/Auckland", capturedSystemPrompt);
        Assert.Contains("Non-US", capturedSystemPrompt);
    }

    [Fact]
    public async Task ChatAsync_UsOperator_SystemPromptShowsUs()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(true);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "OK", InputTokens = 10, OutputTokens = 5 };
            });

        var service = CreateService();
        var messages = new List<AiMessage> { new() { Role = "user", Content = "Hi" } };

        // Act
        await service.ChatAsync(messages, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("US", capturedSystemPrompt);
    }
}