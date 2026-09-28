using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class AiSummarizationServiceTests
{
    private readonly IAiClientService _aiClientMock = Substitute.For<IAiClientService>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly ITaskRepository _taskRepositoryMock = Substitute.For<ITaskRepository>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _courierRepositoryMock = Substitute.For<ICourierRepository>();
    private readonly ITenantInfoService _tenantInfoMock = Substitute.For<ITenantInfoService>();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerSummary = 1024
    });

    private AiSummarizationService CreateService() => new(
        _aiClientMock,
        _noteRepositoryMock,
        _taskRepositoryMock,
        _jobRepositoryMock,
        _courierRepositoryMock,
        _tenantInfoMock,
        _settings);

    [Fact]
    public async Task SummarizeJobNotesAsync_NoNotes_ReturnsDefaultMessage()
    {
        // Arrange
        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No notes found for this job.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
        Assert.Equal(0, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_NullNotes_ReturnsDefaultMessage()
    {
        // Arrange
        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns((List<TucNoteViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No notes found for this job.", result.Summary);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_WithNotes_ReturnsSummary()
    {
        // Arrange
        var notes = new List<TucNoteViewModel>
        {
            new()
            {
                NoteId = 1,
                NoteText = "Driver arrived at pickup",
                NoteTypeName = "Status",
                CreatedByName = "Admin",
                CreatedDate = new DateTimeOffset(2025, 6, 15, 10, 0, 0, TimeSpan.Zero)
            },
            new()
            {
                NoteId = 2,
                NoteText = "Package collected successfully",
                NoteTypeName = "Update",
                CreatedByName = "Driver",
                CreatedDate = new DateTimeOffset(2025, 6, 15, 10, 30, 0, TimeSpan.Zero)
            }
        };

        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns(notes);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), 1024,
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "Driver arrived and collected the package.",
                InputTokens = 150,
                OutputTokens = 30
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Driver arrived and collected the package.", result.Summary);
        Assert.Equal(150, result.Usage.InputTokens);
        Assert.Equal(30, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_NullResponseText_ReturnsFallback()
    {
        // Arrange
        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([
                new TucNoteViewModel
                {
                    NoteId = 1,
                    NoteText = "Test note",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { TextContent = null, InputTokens = 50, OutputTokens = 0 });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Unable to generate summary.", result.Summary);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_SanitizesNoteContent()
    {
        // Arrange
        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([
                new TucNoteViewModel
                {
                    NoteId = 1,
                    NoteText = "Contact driver@test.com for details",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedMessages);
        Assert.Contains("[EMAIL]", capturedMessages[0].Content);
        Assert.DoesNotContain("driver@test.com", capturedMessages[0].Content);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_UsesMaxTokensPerSummary()
    {
        // Arrange
        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([
                new TucNoteViewModel
                {
                    NoteId = 1,
                    NoteText = "Test",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        var capturedMaxTokens = 0;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMaxTokens = callInfo.ArgAt<int>(2);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(1024, capturedMaxTokens);
    }

    [Fact]
    public async Task SummarizeJobEventsAsync_NoEvents_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobEventsAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No events found for this job.", result.Summary);
    }

    [Fact]
    public async Task SummarizeJobEventsAsync_WithEvents_ReturnsSummary()
    {
        // Arrange
        var events = new List<TaskViewModel>
        {
            new()
            {
                Id = 1,
                Title = "Late Alert",
                Description = "Pickup is overdue",
                DueDate = new DateTimeOffset(2025, 6, 15, 9, 0, 0, TimeSpan.Zero),
                Closed = true,
                EventType = "Alert"
            }
        };

        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(events);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "A late alert was triggered and resolved.",
                InputTokens = 100,
                OutputTokens = 20
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobEventsAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("A late alert was triggered and resolved.", result.Summary);
        Assert.Equal(100, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeJobEventsAsync_PassesCorrectFilters()
    {
        // Arrange
        TaskTableFiltersRequest? capturedFilters = null;
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(callInfo =>
            {
                capturedFilters = callInfo.Arg<TaskTableFiltersRequest>();
                return new List<TaskViewModel>();
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobEventsAsync(42, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedFilters);
        Assert.Equal(42, capturedFilters.JobId);
        Assert.True(capturedFilters.ShowCompleted);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_NoTasks_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No open tasks found. The task dashboard is clear.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
        Assert.Equal(0, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_NullTasks_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns((List<TaskViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No open tasks found. The task dashboard is clear.", result.Summary);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_WithTasks_ReturnsSummary()
    {
        // Arrange
        var tasks = new List<TaskViewModel>
        {
            new()
            {
                Id = 1, Title = "ETA Request", Description = "Customer wants ETA",
                DueDate = DateTimeOffset.UtcNow.AddHours(-2), Closed = false,
                EventType = "ETA", JobId = 100, JobNumber = "J100",
                Assignee = new Suggestion { Id = 1, Text = "John" }
            },
            new()
            {
                Id = 2, Title = "Follow up", Description = "DG follow-up required",
                DueDate = DateTimeOffset.UtcNow.AddHours(3), Closed = false,
                EventType = "Follow-up", JobId = 200, JobNumber = "J200"
            }
        };

        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(tasks);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "2 open tasks. 1 overdue ETA request needs attention.",
                InputTokens = 200, OutputTokens = 40
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("2 open tasks. 1 overdue ETA request needs attention.", result.Summary);
        Assert.Equal(200, result.Usage.InputTokens);
        Assert.Equal(40, result.Usage.OutputTokens);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_PassesShowCompletedFalse()
    {
        // Arrange
        TaskTableFiltersRequest? capturedFilters = null;
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(callInfo =>
            {
                capturedFilters = callInfo.Arg<TaskTableFiltersRequest>();
                return new List<TaskViewModel>();
            });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedFilters);
        Assert.False(capturedFilters.ShowCompleted);
        Assert.Null(capturedFilters.JobId);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_IncludesOverdueAndOpenStatus()
    {
        // Arrange
        var tasks = new List<TaskViewModel>
        {
            new()
            {
                Id = 1, Title = "Overdue task", DueDate = DateTimeOffset.UtcNow.AddDays(-1),
                Closed = false, EventType = "Alert", JobNumber = "J1"
            },
            new()
            {
                Id = 2, Title = "Future task", DueDate = DateTimeOffset.UtcNow.AddDays(1),
                Closed = false, EventType = "Follow-up", JobNumber = "J2"
            }
        };

        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(tasks);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(capturedMessages);
        Assert.Contains("OVERDUE", capturedMessages[0].Content);
        Assert.Contains("OPEN", capturedMessages[0].Content);
        Assert.Contains("Total open tasks: 2", capturedMessages[0].Content);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_SanitizesTaskDescriptions()
    {
        // Arrange
        var tasks = new List<TaskViewModel>
        {
            new()
            {
                Id = 1, Title = "Call", Description = "Call driver@test.com about job",
                DueDate = DateTimeOffset.UtcNow.AddHours(1), Closed = false,
                EventType = "Call", JobNumber = "J1"
            }
        };

        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(tasks);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("[EMAIL]", capturedMessages?[0].Content);
        Assert.DoesNotContain("driver@test.com", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SummarizeJobAsync_NoData_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns((JobViewModel?)null);
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns((List<TucNoteViewModel>?)null!);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns((List<TaskViewModel>?)null!);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No data found for this job.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeJobAsync_WithJobOnly_ReturnsSummary()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "ABC123", Status = "Active", SpeedName = "Express",
            From = "Auckland", ToAddress = "Wellington", Courier = "DriverX",
            Booked = new DateTime(2025, 6, 15, 9, 0, 0)
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "Express job booked at 9:00 AM from Auckland to Wellington.",
                InputTokens = 180, OutputTokens = 25
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Express job booked at 9:00 AM", result.Summary);
        Assert.Equal(180, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeJobAsync_WithAllData_IncludesAllSections()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "ABC123", Status = "Active", SpeedName = "Same Day",
            From = "Auckland", ToAddress = "Hamilton"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([
            new TucNoteViewModel
            {
                NoteId = 1, NoteText = "Customer called", NoteTypeName = "Internal",
                CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
            }
        ]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([
                new TaskViewModel
                {
                    Id = 1, Title = "Late Alert", EventType = "Alert",
                    DueDate = DateTimeOffset.UtcNow, Closed = false
                }
            ]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse
                    { TextContent = "Combined summary.", InputTokens = 200, OutputTokens = 30 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("--- Job Details ---", capturedMessages?[0].Content);
        Assert.Contains("--- Notes ---", capturedMessages?[0].Content);
        Assert.Contains("--- Events ---", capturedMessages?[0].Content);
        Assert.Contains("ABC123", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SummarizeJobAsync_SanitizesAddresses()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "Contact: driver@test.com, 123 Street",
            ToAddress = "Call 021-555-1234"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("[EMAIL]", capturedMessages?[0].Content);
        Assert.DoesNotContain("driver@test.com", capturedMessages?[0].Content);
        Assert.Contains("[PHONE]", capturedMessages?[0].Content);
        Assert.DoesNotContain("021-555-1234", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SummarizeOperationsAsync_ReturnsSummaryWithStats()
    {
        // Arrange
        _jobRepositoryMock.GetOverviewStatsAsync().Returns(new OverviewStatsViewModel
        {
            Active = 15, Inactive = 8, Completed = 42
        });

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse
                {
                    TextContent = "15 active, 8 inactive. Inactive count is elevated.",
                    InputTokens = 100, OutputTokens = 25
                };
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeOperationsAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("15 active", result.Summary);
        Assert.Contains("Active jobs: 15", capturedMessages?[0].Content);
        Assert.Contains("Inactive jobs: 8", capturedMessages?[0].Content);
        Assert.Contains("Completed jobs: 42", capturedMessages?[0].Content);
        Assert.Contains("Total: 65", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SummarizeOperationsAsync_NullResponseText_ReturnsFallback()
    {
        // Arrange
        _jobRepositoryMock.GetOverviewStatsAsync().Returns(new OverviewStatsViewModel
        {
            Active = 1, Inactive = 0, Completed = 0
        });

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse { TextContent = null, InputTokens = 50, OutputTokens = 0 });

        var service = CreateService();

        // Act
        var result = await service.SummarizeOperationsAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Unable to generate summary.", result.Summary);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_NoRecords_ReturnsDefaultMessage()
    {
        // Arrange
        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No compliance records found.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_NullRecords_ReturnsDefaultMessage()
    {
        // Arrange
        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns((IReadOnlyList<CourierComplianceViewModel>?)null!);

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No compliance records found.", result.Summary);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_WithExpiredItems_IncludesExpiredSection()
    {
        // Arrange
        var items = new List<CourierComplianceViewModel>
        {
            new()
            {
                Code = "D01", Name = "John Driver", ComplianceType = "License",
                ExpiryDate = DateTimeOffset.UtcNow.AddDays(-10)
            },
            new()
            {
                Code = "D02", Name = "Jane Driver", ComplianceType = "Insurance",
                ExpiryDate = DateTimeOffset.UtcNow.AddDays(3)
            },
            new()
            {
                Code = "D03", Name = "Bob Driver", ComplianceType = "WOF",
                ExpiryDate = DateTimeOffset.UtcNow.AddDays(60)
            }
        };

        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns(items);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse
                {
                    TextContent = "CRITICAL: 1 expired license.", InputTokens = 150, OutputTokens = 20
                };
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("CRITICAL", result.Summary);
        Assert.Contains("EXPIRED items:", capturedMessages?[0].Content);
        Assert.Contains("John Driver (D01)", capturedMessages?[0].Content);
        Assert.Contains("Expired: 1", capturedMessages?[0].Content);
        Assert.Contains("Expiring within 7 days: 1", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_WithManyExpired_TruncatesTo20()
    {
        // Arrange
        var items = new List<CourierComplianceViewModel>();
        for (var i = 0; i < 25; i++)
        {
            items.Add(new CourierComplianceViewModel
            {
                Code = $"D{i:00}", Name = $"Driver {i}", ComplianceType = "License",
                ExpiryDate = DateTimeOffset.UtcNow.AddDays(-5)
            });
        }

        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns(items);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 300, OutputTokens = 30 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("... and 5 more", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_NullLateInfo_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.GetJobForLateCallAsync(1)
            .Returns((JobLateCallDto?)null);

        var service = CreateService();

        // Act
        var result = await service.AnalyzeLateAlertAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No late alert data found for this job.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_WithLateInfo_ReturnsSummary()
    {
        // Arrange
        _jobRepositoryMock.GetJobForLateCallAsync(1)
            .Returns(new JobLateCallDto
            {
                Id = 1, MinutesRemaining = 30, PickupTime = 60, DeliveryTime = 120,
                AlertLatePickup = 15, AlertLateDelivery = 30,
                JobTime = new DateTime(2025, 6, 15, 9, 0, 0),
                BookedSpeed = "Express", NotifiedSpeed = "Express"
            });
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "Job is 15 min late. Recommend: Monitor.",
                InputTokens = 120, OutputTokens = 20
            });

        var service = CreateService();

        // Act
        var result = await service.AnalyzeLateAlertAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Monitor", result.Summary);
        Assert.Equal(120, result.Usage.InputTokens);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_IncludesLateInfoInPrompt()
    {
        // Arrange
        _jobRepositoryMock.GetJobForLateCallAsync(42)
            .Returns(new JobLateCallDto
            {
                Id = 42, MinutesRemaining = 15, PickupTime = 45, DeliveryTime = 90,
                AlertLatePickup = 10, AlertLateDelivery = 20,
                JobTime = new DateTime(2025, 6, 15, 10, 30, 0),
                BookedSpeed = "Same Day", NotifiedSpeed = "Same Day"
            });
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Analysis", InputTokens = 80, OutputTokens = 15 };
            });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(42, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Job #42", capturedMessages?[0].Content);
        Assert.Contains("Minutes remaining: 15", capturedMessages?[0].Content);
        Assert.Contains("Same Day", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_WithRecentEvents_IncludesEvents()
    {
        // Arrange
        _jobRepositoryMock.GetJobForLateCallAsync(1)
            .Returns(new JobLateCallDto
            {
                Id = 1, MinutesRemaining = 10, PickupTime = 30, DeliveryTime = 60,
                AlertLatePickup = 5, AlertLateDelivery = 10,
                JobTime = DateTime.UtcNow, BookedSpeed = "Urgent", NotifiedSpeed = "Urgent"
            });

        var events = new List<TaskViewModel>
        {
            new()
            {
                Id = 1, Title = "Late pickup alert", EventType = "Alert",
                DueDate = DateTimeOffset.UtcNow.AddMinutes(-5), Closed = false
            }
        };
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns(events);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Analysis", InputTokens = 100, OutputTokens = 20 };
            });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Recent events:", capturedMessages?[0].Content);
        Assert.Contains("Late pickup alert", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SuggestCouriersAsync_NullJob_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns((JobViewModel?)null);

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Job not found.", result.Summary);
        Assert.Equal(0, result.Usage.InputTokens);
        Assert.Empty(result.Couriers);
    }

    [Fact]
    public async Task SuggestCouriersAsync_NoCourierData_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", SpeedName = "Express", From = "A", ToAddress = "B"
        });
        _courierRepositoryMock.GetPotentialCouriersAsync(1)
            .Returns([]);
        _courierRepositoryMock.GetDriverWorkOverviewAsync()
            .Returns([]);

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("No courier data available for suggestions.", result.Summary);
        Assert.Empty(result.Couriers);
    }

    [Fact]
    public async Task SuggestCouriersAsync_WithCourierData_ReturnsSummaryAndCouriers()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J100", SpeedName = "Same Day",
            From = "Auckland CBD", ToAddress = "Hamilton", Weight = 5.5
        });
        _courierRepositoryMock.GetPotentialCouriersAsync(1)
            .Returns([
                new PotentialCouriersViewModel
                    { CourierId = 10, Code = "C10", FirstName = "John", Reason = "Closest driver" },
                new PotentialCouriersViewModel
                    { CourierId = 11, Code = "C11", FirstName = "Jane", Reason = "DG certified" }
            ]);
        _courierRepositoryMock.GetDriverWorkOverviewAsync()
            .Returns([
                new DriverWorkOverviewViewModel
                    { CourierId = 10, Name = "John", VehicleType = "Van", JobCount = 3, DriverStatusText = "Active" },
                new DriverWorkOverviewViewModel
                    { CourierId = 11, Name = "Jane", VehicleType = "Car", JobCount = 1, DriverStatusText = "Active" }
            ]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
            {
                TextContent = "1. Jane - lowest workload. 2. John - closest driver.",
                InputTokens = 250, OutputTokens = 40
            });

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Jane", result.Summary);
        Assert.Equal(250, result.Usage.InputTokens);
        Assert.Equal(2, result.Couriers.Count);
        Assert.Equal(10, result.Couriers[0].CourierId);
        Assert.Equal("C10", result.Couriers[0].Code);
        Assert.Equal("John", result.Couriers[0].FirstName);
        Assert.Equal(11, result.Couriers[1].CourierId);
        Assert.Equal("Jane", result.Couriers[1].FirstName);
    }

    [Fact]
    public async Task SuggestCouriersAsync_IncludesJobDetailsInPrompt()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J200", SpeedName = "Express",
            From = "Contact: user@email.com at 10 Queen St",
            ToAddress = "20 King St", Weight = 12.0
        });
        _courierRepositoryMock.GetPotentialCouriersAsync(1)
            .Returns([
                new PotentialCouriersViewModel { CourierId = 1, Code = "C1", FirstName = "Test", Reason = "Match" }
            ]);
        _courierRepositoryMock.GetDriverWorkOverviewAsync()
            .Returns([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedMessages = callInfo.ArgAt<List<AiMessage>>(1);
                return new AiClientResponse { TextContent = "Suggestion", InputTokens = 100, OutputTokens = 15 };
            });

        var service = CreateService();

        // Act
        await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("Job #J200", capturedMessages?[0].Content);
        Assert.Contains("Express", capturedMessages?[0].Content);
        Assert.Contains("Weight: 12", capturedMessages?[0].Content);
        Assert.Contains("[EMAIL]", capturedMessages?[0].Content);
        Assert.DoesNotContain("user@email.com", capturedMessages?[0].Content);
    }

    [Fact]
    public async Task SuggestCouriersAsync_WithOnlyDriverOverview_StillCallsAiButEmptyCouriers()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", From = "A", ToAddress = "B"
        });
        _courierRepositoryMock.GetPotentialCouriersAsync(1)
            .Returns([]);
        _courierRepositoryMock.GetDriverWorkOverviewAsync()
            .Returns([
                new DriverWorkOverviewViewModel
                    { Name = "Driver1", VehicleType = "Van", JobCount = 2, DriverStatusText = "Active" }
            ]);

        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(new AiClientResponse
                { TextContent = "Driver1 recommended.", InputTokens = 80, OutputTokens = 10 });

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal("Driver1 recommended.", result.Summary);
        Assert.Empty(result.Couriers);
        await _aiClientMock.Received().SendMessageAsync(
            Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
            Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_NzTenant_IncludesNzRegionContext()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(false);

        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([
                new TucNoteViewModel
                {
                    NoteId = 1, NoteText = "Test", NoteTypeName = "Note",
                    CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("New Zealand", capturedSystemPrompt);
        Assert.DoesNotContain("US-based", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_UsTenant_IncludesUsRegionContext()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(true);

        _noteRepositoryMock.GetNotesByJobIdAsync(1)
            .Returns([
                new TucNoteViewModel
                {
                    NoteId = 1, NoteText = "Test", NoteTypeName = "Note",
                    CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("US-based", capturedSystemPrompt);
        Assert.DoesNotContain("New Zealand", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(true);

        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([
                new TaskViewModel
                {
                    Id = 1, Title = "Test", DueDate = DateTimeOffset.UtcNow,
                    Closed = false, EventType = "Task", JobNumber = "J1"
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("US-based", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeOperationsAsync_NzTenant_UsesNzRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(false);

        _jobRepositoryMock.GetOverviewStatsAsync().Returns(new OverviewStatsViewModel
        {
            Active = 5, Inactive = 2, Completed = 10
        });

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeOperationsAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("New Zealand", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeJobAsync_PromptsIncludeMarkdownFormattingInstructions()
    {
        // Arrange
        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active", From = "A", ToAddress = "B"
        });
        _noteRepositoryMock.GetNotesByJobIdAsync(1).Returns([]);
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1, TestContext.Current.CancellationToken);

        // Assert — verify the new markdown-oriented prompts
        Assert.Contains("**bold**", capturedSystemPrompt);
        Assert.Contains("**Status**", capturedSystemPrompt);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(true);

        _courierRepositoryMock.GetCourierComplianceForExportAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns([
                new CourierComplianceViewModel
                {
                    Code = "D01", Name = "Driver", ComplianceType = "License",
                    ExpiryDate = DateTimeOffset.UtcNow.AddDays(-5)
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SummarizeComplianceAsync(TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("US-based", capturedSystemPrompt);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_NzTenant_UsesNzRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(false);

        _jobRepositoryMock.GetJobForLateCallAsync(1)
            .Returns(new JobLateCallDto
            {
                Id = 1, MinutesRemaining = 10, PickupTime = 30, DeliveryTime = 60,
                AlertLatePickup = 5, AlertLateDelivery = 10,
                JobTime = DateTime.UtcNow, BookedSpeed = "Express", NotifiedSpeed = "Express"
            });
        _taskRepositoryMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>())
            .Returns([]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Analysis", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("New Zealand", capturedSystemPrompt);
    }

    [Fact]
    public async Task SuggestCouriersAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.IsUsTenant().Returns(true);

        _jobRepositoryMock.GetSingleJobById(1).Returns(new JobViewModel
        {
            Id = 1, JobNo = "J1", From = "NYC", ToAddress = "LA"
        });
        _courierRepositoryMock.GetPotentialCouriersAsync(1)
            .Returns([
                new PotentialCouriersViewModel { CourierId = 1, Code = "C1", FirstName = "Test", Reason = "Match" }
            ]);
        _courierRepositoryMock.GetDriverWorkOverviewAsync()
            .Returns([
                new DriverWorkOverviewViewModel
                    { CourierId = 1, Name = "Test", VehicleType = "Van", JobCount = 2, DriverStatusText = "Active" }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.SendMessageAsync(
                Arg.Any<string>(), Arg.Any<List<AiMessage>>(), Arg.Any<int>(),
                Arg.Any<List<AiToolDefinition>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                capturedSystemPrompt = callInfo.ArgAt<string>(0);
                return new AiClientResponse { TextContent = "Suggestion", InputTokens = 50, OutputTokens = 10 };
            });

        var service = CreateService();

        // Act
        await service.SuggestCouriersAsync(1, TestContext.Current.CancellationToken);

        // Assert
        Assert.Contains("US-based", capturedSystemPrompt);
    }

}
