using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class NoteControllerTests
{
    private readonly Mock<INoteRepository> _noteRepositoryMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();

    private NoteController CreateController() => new(
        _noteRepositoryMock.Object,
        _recurringJobRepositoryMock.Object
    );

    [Theory]
    [InlineData("Note", NoteHistorySource.Note)]
    [InlineData("BulkNote", NoteHistorySource.BulkNote)]
    [InlineData("Archive", NoteHistorySource.Archive)]
    public async Task GetNoteHistory_WithValidNoteSource_ParsesEnumAndCallsRepository(string noteSource, NoteHistorySource expectedSource)
    {
        // Arrange
        const int noteId = 1;
        _noteRepositoryMock
            .Setup(x => x.GetNoteHistoryAsync(noteId, expectedSource))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(noteId, noteSource);

        // Assert
        Assert.IsType<JsonResult>(result);
        _noteRepositoryMock.Verify(x => x.GetNoteHistoryAsync(noteId, expectedSource), Times.Once);
    }

    [Theory]
    [InlineData("note")]
    [InlineData("bulknote")]
    [InlineData("ARCHIVE")]
    [InlineData("bulkNote")]
    public async Task GetNoteHistory_WithCaseInsensitiveNoteSource_ParsesCorrectly(string noteSource)
    {
        // Arrange
        const int noteId = 1;
        _noteRepositoryMock
            .Setup(x => x.GetNoteHistoryAsync(noteId, It.IsAny<NoteHistorySource>()))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(noteId, noteSource);

        // Assert
        Assert.IsType<JsonResult>(result);
    }

    [Theory]
    [InlineData("Invalid")]
    [InlineData("")]
    [InlineData("ActiveNote")]
    [InlineData("bulk")]
    public async Task GetNoteHistory_WithInvalidNoteSource_ReturnsBadRequest(string noteSource)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(1, noteSource);

        // Assert
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal($"Invalid noteSource: {noteSource}", badRequest.Value);
    }

    [Fact]
    public async Task GetNoteHistory_DefaultNoteSource_UsesNote()
    {
        // Arrange
        const int noteId = 5;
        _noteRepositoryMock
            .Setup(x => x.GetNoteHistoryAsync(noteId, NoteHistorySource.Note))
            .ReturnsAsync([]);

        var controller = CreateController();

        // Act — call without specifying noteSource, default is "Note"
        var result = await controller.GetNoteHistory(noteId);

        // Assert
        Assert.IsType<JsonResult>(result);
        _noteRepositoryMock.Verify(x => x.GetNoteHistoryAsync(noteId, NoteHistorySource.Note), Times.Once);
    }

    [Fact]
    public async Task GetNoteHistory_ReturnsHistoryFromRepository()
    {
        // Arrange
        const int noteId = 1;
        var expectedHistory = new List<NoteHistoryViewModel>
        {
            new() { NoteHistoryId = 1, NoteId = noteId, NewNoteText = "Edit 1" },
            new() { NoteHistoryId = 2, NoteId = noteId, NewNoteText = "Edit 2" }
        };
        _noteRepositoryMock
            .Setup(x => x.GetNoteHistoryAsync(noteId, NoteHistorySource.Note))
            .ReturnsAsync(expectedHistory);

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(noteId);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedHistory, jsonResult.Value);
    }

    [Fact]
    public async Task GetNoteHistory_RepositoryThrows_Returns500()
    {
        // Arrange
        _noteRepositoryMock
            .Setup(x => x.GetNoteHistoryAsync(It.IsAny<int>(), It.IsAny<NoteHistorySource>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(1);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

}
