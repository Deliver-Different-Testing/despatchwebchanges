using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class NoteControllerTests
{
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly IRecurringJobRepository _recurringJobRepositoryMock = Substitute.For<IRecurringJobRepository>();

    private NoteController CreateController() => new(
        _noteRepositoryMock,
        _recurringJobRepositoryMock
    );

    [Theory]
    [InlineData("Note", NoteHistorySource.Note)]
    [InlineData("BulkNote", NoteHistorySource.BulkNote)]
    [InlineData("Archive", NoteHistorySource.Archive)]
    public async Task GetNoteHistory_WithValidNoteSource_ParsesEnumAndCallsRepository(string noteSource,
        NoteHistorySource expectedSource)
    {
        // Arrange
        const int noteId = 1;
        _noteRepositoryMock.GetNoteHistoryAsync(noteId, expectedSource)
            .Returns([]);

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(noteId, noteSource);

        // Assert
        Assert.IsType<JsonResult>(result);
        await _noteRepositoryMock.Received().GetNoteHistoryAsync(noteId, expectedSource);
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
        _noteRepositoryMock.GetNoteHistoryAsync(noteId, Arg.Any<NoteHistorySource>())
            .Returns([]);

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
        _noteRepositoryMock.GetNoteHistoryAsync(noteId, NoteHistorySource.Note)
            .Returns([]);

        var controller = CreateController();

        // Act — call without specifying noteSource, default is "Note"
        var result = await controller.GetNoteHistory(noteId);

        // Assert
        Assert.IsType<JsonResult>(result);
        await _noteRepositoryMock.Received().GetNoteHistoryAsync(noteId, NoteHistorySource.Note);
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
        _noteRepositoryMock.GetNoteHistoryAsync(noteId, NoteHistorySource.Note)
            .Returns(expectedHistory);

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
        _noteRepositoryMock.GetNoteHistoryAsync(Arg.Any<int>(), Arg.Any<NoteHistorySource>())
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetNoteHistory(1);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }
}