using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
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

    private readonly IOptions<AnthropicSettings> _settings = Options.Create(new AnthropicSettings
    {
        MaxTokensPerSummary = 1024
    });

    private AiSummarizationService CreateService() => new(
        _aiClientMock.Object,
        _noteRepositoryMock.Object,
        _taskRepositoryMock.Object,
        _settings);

    #region SummarizeJobNotesAsync

    [Fact]
    public async Task SummarizeJobNotesAsync_NoNotes_ReturnsDefaultMessage()
    {
        // Arrange
        _noteRepositoryMock.Setup(x => x.GetNotesByJobIdAsync(1))
            .ReturnsAsync(new List<TucNoteViewModel>());

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
            .ReturnsAsync((List<TucNoteViewModel>)null);

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
            .ReturnsAsync(new List<TucNoteViewModel>
            {
                new()
                {
                    NoteId = 1,
                    NoteText = "Test note",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            });

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
            .ReturnsAsync(new List<TucNoteViewModel>
            {
                new()
                {
                    NoteId = 1,
                    NoteText = "Contact driver@test.com for details",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            });

        List<AiMessage> capturedMessages = null;
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
            .ReturnsAsync(new List<TucNoteViewModel>
            {
                new()
                {
                    NoteId = 1,
                    NoteText = "Test",
                    NoteTypeName = "Note",
                    CreatedByName = "Admin",
                    CreatedDate = DateTimeOffset.UtcNow
                }
            });

        int capturedMaxTokens = 0;
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
            .ReturnsAsync(new List<TaskViewModel>());

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
        TaskTableFiltersRequest capturedFilters = null;
        _taskRepositoryMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .Callback<TaskTableFiltersRequest>(f => capturedFilters = f)
            .ReturnsAsync(new List<TaskViewModel>());

        var service = CreateService();

        // Act
        await service.SummarizeJobEventsAsync(42);

        // Assert
        capturedFilters.Should().NotBeNull();
        capturedFilters.JobId.Should().Be(42);
        capturedFilters.ShowCompleted.Should().BeTrue();
    }

    #endregion
}
