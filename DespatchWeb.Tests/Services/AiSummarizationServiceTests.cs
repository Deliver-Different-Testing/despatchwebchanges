using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.Extensions.Options;
using Moq;

namespace DespatchWeb.Tests.Services;

public class AiSummarizationServiceTests
{
    private readonly Mock<IAiClientService> _aiClientMock = new();
    private readonly Mock<INoteRepository> _noteRepositoryMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoMock = new();

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerSummary = 1024
    });

    private AiSummarizationService CreateService() => new(
        _aiClientMock.Object,
        _noteRepositoryMock.Object,
        _taskRepositoryMock.Object,
        _jobRepositoryMock.Object,
        _courierRepositoryMock.Object,
        _tenantInfoMock.Object,
        _settings);

    #region SummarizeJobNotesAsync

    [Fact]
    public async Task SummarizeJobNotesAsync_NoNotes_ReturnsDefaultMessage()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1);

        // Assert
        result.Summary.Should().Be("No notes found for this job.");
        result.Usage.InputTokens.Should().Be(0);
        result.Usage.OutputTokens.Should().Be(0);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_NullNotes_ReturnsDefaultMessage()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync((List<TucNoteViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1);

        // Assert
        result.Summary.Should().Be("No notes found for this job.");
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

        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync(notes);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), 1024,
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "Driver arrived and collected the package.",
                InputTokens = 150,
                OutputTokens = 30
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1);

        // Assert
        result.Summary.Should().Be("Driver arrived and collected the package.");
        result.Usage.InputTokens.Should().Be(150);
        result.Usage.OutputTokens.Should().Be(30);
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_NullResponseText_ReturnsFallback()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([
                new TucNoteViewModel
                {
                    NoteId = 1,
                    NoteText = "Test note",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse { TextContent = null, InputTokens = 50, OutputTokens = 0 });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobNotesAsync(1);

        // Assert
        result.Summary.Should().Be("Unable to generate summary.");
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_SanitizesNoteContent()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([
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
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1);

        // Assert
        capturedMessages.Should().NotBeNull();
        capturedMessages[0].Content.Should().Contain("[EMAIL]");
        capturedMessages[0].Content.Should().NotContain("driver@test.com");
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_UsesMaxTokensPerSummary()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([
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
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, _, maxTokens, _, _) => capturedMaxTokens = maxTokens)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1);

        // Assert
        capturedMaxTokens.Should().Be(1024);
    }

    #endregion

    #region SummarizeJobEventsAsync

    [Fact]
    public async Task SummarizeJobEventsAsync_NoEvents_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobEventsAsync(1);

        // Assert
        result.Summary.Should().Be("No events found for this job.");
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

        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync(events);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "A late alert was triggered and resolved.",
                InputTokens = 100,
                OutputTokens = 20
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobEventsAsync(1);

        // Assert
        result.Summary.Should().Be("A late alert was triggered and resolved.");
        result.Usage.InputTokens.Should().Be(100);
    }

    [Fact]
    public async Task SummarizeJobEventsAsync_PassesCorrectFilters()
    {
        // Arrange
        TaskTableFiltersRequest? capturedFilters = null;
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .Callback<TaskTableFiltersRequest>(f => capturedFilters = f)
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        await service.SummarizeJobEventsAsync(42);

        // Assert
        capturedFilters.Should().NotBeNull();
        capturedFilters.JobId.Should().Be(42);
        capturedFilters.ShowCompleted.Should().BeTrue();
    }

    #endregion

    #region SummarizeTaskDashboardAsync

    [Fact]
    public async Task SummarizeTaskDashboardAsync_NoTasks_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync();

        // Assert
        result.Summary.Should().Be("No open tasks found. The task dashboard is clear.");
        result.Usage.InputTokens.Should().Be(0);
        result.Usage.OutputTokens.Should().Be(0);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_NullTasks_ReturnsDefaultMessage()
    {
        // Arrange
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync((List<TaskViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync();

        // Assert
        result.Summary.Should().Be("No open tasks found. The task dashboard is clear.");
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

        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync(tasks);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "2 open tasks. 1 overdue ETA request needs attention.",
                InputTokens = 200, OutputTokens = 40
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeTaskDashboardAsync();

        // Assert
        result.Summary.Should().Be("2 open tasks. 1 overdue ETA request needs attention.");
        result.Usage.InputTokens.Should().Be(200);
        result.Usage.OutputTokens.Should().Be(40);
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_PassesShowCompletedFalse()
    {
        // Arrange
        TaskTableFiltersRequest? capturedFilters = null;
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .Callback<TaskTableFiltersRequest>(f => capturedFilters = f)
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync();

        // Assert
        capturedFilters.Should().NotBeNull();
        capturedFilters.ShowCompleted.Should().BeFalse();
        capturedFilters.JobId.Should().BeNull();
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

        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync(tasks);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync();

        // Assert
        capturedMessages.Should().NotBeNull();
        capturedMessages[0].Content.Should().Contain("OVERDUE");
        capturedMessages[0].Content.Should().Contain("OPEN");
        capturedMessages[0].Content.Should().Contain("Total open tasks: 2");
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

        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync(tasks);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync();

        // Assert
        capturedMessages?[0].Content.Should().Contain("[EMAIL]");
        capturedMessages?[0].Content.Should().NotContain("driver@test.com");
    }

    #endregion

    #region SummarizeJobAsync

    [Fact]
    public async Task SummarizeJobAsync_NoData_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync((JobViewModel?)null);
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1)).ReturnsAsync((List<TucNoteViewModel>?)null);
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync((List<TaskViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobAsync(1);

        // Assert
        result.Summary.Should().Be("No data found for this job.");
        result.Usage.InputTokens.Should().Be(0);
    }

    [Fact]
    public async Task SummarizeJobAsync_WithJobOnly_ReturnsSummary()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "ABC123", Status = "Active", SpeedName = "Express",
            From = "Auckland", ToAddress = "Wellington", Courier = "DriverX",
            Booked = new DateTime(2025, 6, 15, 9, 0, 0)
        });
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1)).ReturnsAsync([]);
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "Express job booked at 9:00 AM from Auckland to Wellington.",
                InputTokens = 180, OutputTokens = 25
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeJobAsync(1);

        // Assert
        result.Summary.Should().Contain("Express job booked at 9:00 AM");
        result.Usage.InputTokens.Should().Be(180);
    }

    [Fact]
    public async Task SummarizeJobAsync_WithAllData_IncludesAllSections()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "ABC123", Status = "Active", SpeedName = "Same Day",
            From = "Auckland", ToAddress = "Hamilton"
        });
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1)).ReturnsAsync([
            new TucNoteViewModel
            {
                NoteId = 1, NoteText = "Customer called", NoteTypeName = "Internal",
                CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
            }
        ]);
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([
                new TaskViewModel
                {
                    Id = 1, Title = "Late Alert", EventType = "Alert",
                    DueDate = DateTimeOffset.UtcNow, Closed = false
                }
            ]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Combined summary.", InputTokens = 200, OutputTokens = 30 });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1);

        // Assert
        capturedMessages?[0].Content.Should().Contain("--- Job Details ---");
        capturedMessages?[0].Content.Should().Contain("--- Notes ---");
        capturedMessages?[0].Content.Should().Contain("--- Events ---");
        capturedMessages?[0].Content.Should().Contain("ABC123");
    }

    [Fact]
    public async Task SummarizeJobAsync_SanitizesAddresses()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active",
            From = "Contact: driver@test.com, 123 Street",
            ToAddress = "Call 021-555-1234"
        });
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1)).ReturnsAsync([]);
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1);

        // Assert
        capturedMessages?[0].Content.Should().Contain("[EMAIL]");
        capturedMessages?[0].Content.Should().NotContain("driver@test.com");
        capturedMessages?[0].Content.Should().Contain("[PHONE]");
        capturedMessages?[0].Content.Should().NotContain("021-555-1234");
    }

    #endregion

    #region SummarizeOperationsAsync

    [Fact]
    public async Task SummarizeOperationsAsync_ReturnsSummaryWithStats()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetOverviewStatsAsync()).ReturnsAsync(new OverviewStatsViewModel
        {
            Active = 15, Inactive = 8, Completed = 42
        });

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "15 active, 8 inactive. Inactive count is elevated.",
                InputTokens = 100, OutputTokens = 25
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeOperationsAsync();

        // Assert
        result.Summary.Should().Contain("15 active");
        capturedMessages?[0].Content.Should().Contain("Active jobs: 15");
        capturedMessages?[0].Content.Should().Contain("Inactive jobs: 8");
        capturedMessages?[0].Content.Should().Contain("Completed jobs: 42");
        capturedMessages?[0].Content.Should().Contain("Total: 65");
    }

    [Fact]
    public async Task SummarizeOperationsAsync_NullResponseText_ReturnsFallback()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetOverviewStatsAsync()).ReturnsAsync(new OverviewStatsViewModel
        {
            Active = 1, Inactive = 0, Completed = 0
        });

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse { TextContent = null, InputTokens = 50, OutputTokens = 0 });

        var service = CreateService();

        // Act
        var result = await service.SummarizeOperationsAsync();

        // Assert
        result.Summary.Should().Be("Unable to generate summary.");
    }

    #endregion

    #region SummarizeComplianceAsync

    [Fact]
    public async Task SummarizeComplianceAsync_NoRecords_ReturnsDefaultMessage()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync();

        // Assert
        result.Summary.Should().Be("No compliance records found.");
        result.Usage.InputTokens.Should().Be(0);
    }

    [Fact]
    public async Task SummarizeComplianceAsync_NullRecords_ReturnsDefaultMessage()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync((List<CourierComplianceViewModel>?)null);

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync();

        // Assert
        result.Summary.Should().Be("No compliance records found.");
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

        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync(items);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "CRITICAL: 1 expired license.", InputTokens = 150, OutputTokens = 20
            });

        var service = CreateService();

        // Act
        var result = await service.SummarizeComplianceAsync();

        // Assert
        result.Summary.Should().Contain("CRITICAL");
        capturedMessages?[0].Content.Should().Contain("EXPIRED items:");
        capturedMessages?[0].Content.Should().Contain("John Driver (D01)");
        capturedMessages?[0].Content.Should().Contain("Expired: 1");
        capturedMessages?[0].Content.Should().Contain("Expiring within 7 days: 1");
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

        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync(items);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 300, OutputTokens = 30 });

        var service = CreateService();

        // Act
        await service.SummarizeComplianceAsync();

        // Assert
        capturedMessages?[0].Content.Should().Contain("... and 5 more");
    }

    #endregion

    #region AnalyzeLateAlertAsync

    [Fact]
    public async Task AnalyzeLateAlertAsync_NullLateInfo_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetJobForLateCallAsync(1))
            .ReturnsAsync((Models.Dto.JobLateCallDto?)null);

        var service = CreateService();

        // Act
        var result = await service.AnalyzeLateAlertAsync(1);

        // Assert
        result.Summary.Should().Be("No late alert data found for this job.");
        result.Usage.InputTokens.Should().Be(0);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_WithLateInfo_ReturnsSummary()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetJobForLateCallAsync(1))
            .ReturnsAsync(new Models.Dto.JobLateCallDto
            {
                Id = 1, MinutesRemaining = 30, PickupTime = 60, DeliveryTime = 120,
                AlertLatePickup = 15, AlertLateDelivery = 30,
                JobTime = new DateTime(2025, 6, 15, 9, 0, 0),
                BookedSpeed = "Express", NotifiedSpeed = "Express"
            });
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "Job is 15 min late. Recommend: Monitor.",
                InputTokens = 120, OutputTokens = 20
            });

        var service = CreateService();

        // Act
        var result = await service.AnalyzeLateAlertAsync(1);

        // Assert
        result.Summary.Should().Contain("Monitor");
        result.Usage.InputTokens.Should().Be(120);
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_IncludesLateInfoInPrompt()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetJobForLateCallAsync(42))
            .ReturnsAsync(new Models.Dto.JobLateCallDto
            {
                Id = 42, MinutesRemaining = 15, PickupTime = 45, DeliveryTime = 90,
                AlertLatePickup = 10, AlertLateDelivery = 20,
                JobTime = new DateTime(2025, 6, 15, 10, 30, 0),
                BookedSpeed = "Same Day", NotifiedSpeed = "Same Day"
            });
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Analysis", InputTokens = 80, OutputTokens = 15 });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(42);

        // Assert
        capturedMessages?[0].Content.Should().Contain("Job #42");
        capturedMessages?[0].Content.Should().Contain("Minutes remaining: 15");
        capturedMessages?[0].Content.Should().Contain("Same Day");
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_WithRecentEvents_IncludesEvents()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetJobForLateCallAsync(1))
            .ReturnsAsync(new Models.Dto.JobLateCallDto
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
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync(events);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Analysis", InputTokens = 100, OutputTokens = 20 });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(1);

        // Assert
        capturedMessages?[0].Content.Should().Contain("Recent events:");
        capturedMessages?[0].Content.Should().Contain("Late pickup alert");
    }

    #endregion

    #region SuggestCouriersAsync

    [Fact]
    public async Task SuggestCouriersAsync_NullJob_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync((JobViewModel?)null);

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1);

        // Assert
        result.Summary.Should().Be("Job not found.");
        result.Usage.InputTokens.Should().Be(0);
        result.Couriers.Should().BeEmpty();
    }

    [Fact]
    public async Task SuggestCouriersAsync_NoCourierData_ReturnsDefaultMessage()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J1", SpeedName = "Express", From = "A", ToAddress = "B"
        });
        _courierRepositoryMock.Setup(x => x.GetPotentialCouriersAsync(1))
            .ReturnsAsync([]);
        _courierRepositoryMock.Setup(x => x.GetDriverWorkOverviewAsync())
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1);

        // Assert
        result.Summary.Should().Be("No courier data available for suggestions.");
        result.Couriers.Should().BeEmpty();
    }

    [Fact]
    public async Task SuggestCouriersAsync_WithCourierData_ReturnsSummaryAndCouriers()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J100", SpeedName = "Same Day",
            From = "Auckland CBD", ToAddress = "Hamilton", Weight = 5.5
        });
        _courierRepositoryMock.Setup(x => x.GetPotentialCouriersAsync(1))
            .ReturnsAsync([
                new PotentialCouriersViewModel { CourierId = 10, Code = "C10", FirstName = "John", Reason = "Closest driver" },
                new PotentialCouriersViewModel { CourierId = 11, Code = "C11", FirstName = "Jane", Reason = "DG certified" }
            ]);
        _courierRepositoryMock.Setup(x => x.GetDriverWorkOverviewAsync())
            .ReturnsAsync([
                new DriverWorkOverviewViewModel { CourierId = 10, Name = "John", VehicleType = "Van", JobCount = 3, DriverStatusText = "Active" },
                new DriverWorkOverviewViewModel { CourierId = 11, Name = "Jane", VehicleType = "Car", JobCount = 1, DriverStatusText = "Active" }
            ]);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse
            {
                TextContent = "1. Jane - lowest workload. 2. John - closest driver.",
                InputTokens = 250, OutputTokens = 40
            });

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1);

        // Assert
        result.Summary.Should().Contain("Jane");
        result.Usage.InputTokens.Should().Be(250);
        result.Couriers.Should().HaveCount(2);
        result.Couriers[0].CourierId.Should().Be(10);
        result.Couriers[0].Code.Should().Be("C10");
        result.Couriers[0].FirstName.Should().Be("John");
        result.Couriers[1].CourierId.Should().Be(11);
        result.Couriers[1].FirstName.Should().Be("Jane");
    }

    [Fact]
    public async Task SuggestCouriersAsync_IncludesJobDetailsInPrompt()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J200", SpeedName = "Express",
            From = "Contact: user@email.com at 10 Queen St",
            ToAddress = "20 King St", Weight = 12.0
        });
        _courierRepositoryMock.Setup(x => x.GetPotentialCouriersAsync(1))
            .ReturnsAsync([new PotentialCouriersViewModel { CourierId = 1, Code = "C1", FirstName = "Test", Reason = "Match" }]);
        _courierRepositoryMock.Setup(x => x.GetDriverWorkOverviewAsync())
            .ReturnsAsync([]);

        List<AiMessage>? capturedMessages = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (_, msgs, _, _, _) => capturedMessages = msgs)
            .ReturnsAsync(new AiClientResponse { TextContent = "Suggestion", InputTokens = 100, OutputTokens = 15 });

        var service = CreateService();

        // Act
        await service.SuggestCouriersAsync(1);

        // Assert
        capturedMessages?[0].Content.Should().Contain("Job #J200");
        capturedMessages?[0].Content.Should().Contain("Express");
        capturedMessages?[0].Content.Should().Contain("Weight: 12");
        capturedMessages?[0].Content.Should().Contain("[EMAIL]");
        capturedMessages?[0].Content.Should().NotContain("user@email.com");
    }

    [Fact]
    public async Task SuggestCouriersAsync_WithOnlyDriverOverview_StillCallsAiButEmptyCouriers()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J1", From = "A", ToAddress = "B"
        });
        _courierRepositoryMock.Setup(x => x.GetPotentialCouriersAsync(1))
            .ReturnsAsync([]);
        _courierRepositoryMock.Setup(x => x.GetDriverWorkOverviewAsync())
            .ReturnsAsync([new DriverWorkOverviewViewModel { Name = "Driver1", VehicleType = "Van", JobCount = 2, DriverStatusText = "Active" }]);

        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AiClientResponse { TextContent = "Driver1 recommended.", InputTokens = 80, OutputTokens = 10 });

        var service = CreateService();

        // Act
        var result = await service.SuggestCouriersAsync(1);

        // Assert
        result.Summary.Should().Be("Driver1 recommended.");
        result.Couriers.Should().BeEmpty();
        _aiClientMock.Verify(x => x.SendMessageAsync(
            It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
            It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Region-Aware Prompts

    [Fact]
    public async Task SummarizeJobNotesAsync_NzTenant_IncludesNzRegionContext()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(false);

        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([
                new TucNoteViewModel
                {
                    NoteId = 1, NoteText = "Test", NoteTypeName = "Note",
                    CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1);

        // Assert
        capturedSystemPrompt.Should().Contain("New Zealand");
        capturedSystemPrompt.Should().NotContain("US-based");
    }

    [Fact]
    public async Task SummarizeJobNotesAsync_UsTenant_IncludesUsRegionContext()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(true);

        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync([
                new TucNoteViewModel
                {
                    NoteId = 1, NoteText = "Test", NoteTypeName = "Note",
                    CreatedByName = "Admin", CreatedDate = DateTimeOffset.UtcNow
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobNotesAsync(1);

        // Assert
        capturedSystemPrompt.Should().Contain("US-based");
        capturedSystemPrompt.Should().NotContain("New Zealand");
    }

    [Fact]
    public async Task SummarizeTaskDashboardAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(true);

        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([
                new TaskViewModel
                {
                    Id = 1, Title = "Test", DueDate = DateTimeOffset.UtcNow,
                    Closed = false, EventType = "Task", JobNumber = "J1"
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeTaskDashboardAsync();

        // Assert
        capturedSystemPrompt.Should().Contain("US-based");
    }

    [Fact]
    public async Task SummarizeOperationsAsync_NzTenant_UsesNzRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(false);

        _jobRepositoryMock.Setup(x => x.GetOverviewStatsAsync()).ReturnsAsync(new OverviewStatsViewModel
        {
            Active = 5, Inactive = 2, Completed = 10
        });

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeOperationsAsync();

        // Assert
        capturedSystemPrompt.Should().Contain("New Zealand");
    }

    [Fact]
    public async Task SummarizeJobAsync_PromptsIncludeMarkdownFormattingInstructions()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J1", Status = "Active", From = "A", ToAddress = "B"
        });
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1)).ReturnsAsync([]);
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeJobAsync(1);

        // Assert — verify the new markdown-oriented prompts
        capturedSystemPrompt.Should().Contain("**bold**");
        capturedSystemPrompt.Should().Contain("**Status**");
    }

    [Fact]
    public async Task SummarizeComplianceAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(true);

        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync([
                new CourierComplianceViewModel
                {
                    Code = "D01", Name = "Driver", ComplianceType = "License",
                    ExpiryDate = DateTimeOffset.UtcNow.AddDays(-5)
                }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Summary", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SummarizeComplianceAsync();

        // Assert
        capturedSystemPrompt.Should().Contain("US-based");
    }

    [Fact]
    public async Task AnalyzeLateAlertAsync_NzTenant_UsesNzRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(false);

        _jobRepositoryMock.Setup(x => x.GetJobForLateCallAsync(1))
            .ReturnsAsync(new Models.Dto.JobLateCallDto
            {
                Id = 1, MinutesRemaining = 10, PickupTime = 30, DeliveryTime = 60,
                AlertLatePickup = 5, AlertLateDelivery = 10,
                JobTime = DateTime.UtcNow, BookedSpeed = "Express", NotifiedSpeed = "Express"
            });
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ReturnsAsync([]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Analysis", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.AnalyzeLateAlertAsync(1);

        // Assert
        capturedSystemPrompt.Should().Contain("New Zealand");
    }

    [Fact]
    public async Task SuggestCouriersAsync_UsTenant_UsesUsRegionInPrompt()
    {
        // Arrange
        _tenantInfoMock.Setup(x => x.IsUsTenant()).Returns(true);

        _jobRepositoryMock.Setup(x => x.GetSingleJobById(1)).ReturnsAsync(new JobViewModel
        {
            Id = 1, JobNo = "J1", From = "NYC", ToAddress = "LA"
        });
        _courierRepositoryMock.Setup(x => x.GetPotentialCouriersAsync(1))
            .ReturnsAsync([new PotentialCouriersViewModel { CourierId = 1, Code = "C1", FirstName = "Test", Reason = "Match" }]);
        _courierRepositoryMock.Setup(x => x.GetDriverWorkOverviewAsync())
            .ReturnsAsync([
                new DriverWorkOverviewViewModel { CourierId = 1, Name = "Test", VehicleType = "Van", JobCount = 2, DriverStatusText = "Active" }
            ]);

        string? capturedSystemPrompt = null;
        _aiClientMock.Setup(x => x.SendMessageAsync(
                It.IsAny<string>(), It.IsAny<List<AiMessage>>(), It.IsAny<int>(),
                It.IsAny<List<AiToolDefinition>>(), It.IsAny<CancellationToken>()))
            .Callback<string, List<AiMessage>, int, List<AiToolDefinition>, CancellationToken>(
                (sys, _, _, _, _) => capturedSystemPrompt = sys)
            .ReturnsAsync(new AiClientResponse { TextContent = "Suggestion", InputTokens = 50, OutputTokens = 10 });

        var service = CreateService();

        // Act
        await service.SuggestCouriersAsync(1);

        // Assert
        capturedSystemPrompt.Should().Contain("US-based");
    }

    #endregion
}
