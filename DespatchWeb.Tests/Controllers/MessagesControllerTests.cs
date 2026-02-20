using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for MessagesController - tests all messaging endpoints.
/// These tests use mocks to isolate controller logic for debugging and validation.
/// </summary>
public class MessagesControllerTests
{
    #region Setup

    private readonly Mock<IMessageRepository> _messageRepositoryMock = new();

    private MessagesController CreateController() => new(_messageRepositoryMock.Object);

    #endregion

    #region GetUnreadMessageCount Tests

    [Fact]
    public async Task GetUnreadMessageCount_Success_ReturnsJsonWithCount()
    {
        // Arrange
        const int expectedCount = 5;
        _messageRepositoryMock.Setup(x => x.GetUnreadMessageCountAsync())
            .ReturnsAsync(expectedCount);

        var controller = CreateController();

        // Act
        var result = await controller.GetUnreadMessageCount();

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().Be(expectedCount);
    }

    [Fact]
    public async Task GetUnreadMessageCount_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetUnreadMessageCountAsync())
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetUnreadMessageCount();

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
        statusCodeResult.Value.Should().Be("Database error");
    }

    #endregion

    #region GetRecentList Tests

    [Fact]
    public async Task GetRecentList_Success_ReturnsJsonWithRecents()
    {
        // Arrange
        var expectedRecents = new List<RecentMessageViewModel>
        {
            new() { OtherPartyName = "Courier 1", UnreadCount = 2, LastMessage = "Hello" },
            new() { OtherPartyName = "Staff 1", UnreadCount = 0, LastMessage = "Hi there" }
        };
        _messageRepositoryMock.Setup(x => x.GetRecentListAsync())
            .ReturnsAsync(expectedRecents);

        var controller = CreateController();

        // Act
        var result = await controller.GetRecentList();

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().BeEquivalentTo(expectedRecents);
    }

    [Fact]
    public async Task GetRecentList_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetRecentListAsync())
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetRecentList();

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetMessages Tests

    [Fact]
    public async Task GetMessages_ValidIds_ReturnsJsonWithMessages()
    {
        // Arrange
        const int courierId = 1;
        const int staffId = 2;
        var expectedMessages = new List<ChatMessageViewModel>
        {
            new() { Message = "Hello", MessageId = 1 },
            new() { Message = "Hi", MessageId = 2 }
        };
        _messageRepositoryMock.Setup(x => x.GetMessagesByCourierIdAsync(courierId, staffId))
            .ReturnsAsync(expectedMessages);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessages(courierId, staffId);

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().BeEquivalentTo(expectedMessages);
    }

    [Fact]
    public async Task GetMessages_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetMessagesByCourierIdAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessages(1, 2);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetMessagesByStaff Tests

    [Fact]
    public async Task GetMessagesByStaff_ValidIds_ReturnsJsonWithMessages()
    {
        // Arrange
        const int otherStaffId = 1;
        const int currentStaffId = 2;
        var expectedMessages = new List<ChatMessageViewModel>
        {
            new() { Message = "Staff message 1", MessageId = 1 },
            new() { Message = "Staff message 2", MessageId = 2 }
        };
        _messageRepositoryMock.Setup(x => x.GetMessagesByStaffIdAsync(otherStaffId, currentStaffId))
            .ReturnsAsync(expectedMessages);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessagesByStaff(otherStaffId, currentStaffId);

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().BeEquivalentTo(expectedMessages);
    }

    [Fact]
    public async Task GetMessagesByStaff_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetMessagesByStaffIdAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessagesByStaff(1, 2);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region SendMessage Tests

    [Fact]
    public async Task SendMessage_ValidCourierRecipient_ReturnsOk()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            Message = "Test message",
            SendToCourierId = 1,
            SendToStaffId = null
        };
        _messageRepositoryMock.Setup(x => x.SendMessageAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.SendMessageAsync(request), Times.Once);
    }

    [Fact]
    public async Task SendMessage_ValidStaffRecipient_ReturnsOk()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            Message = "Test message",
            SendToCourierId = null,
            SendToStaffId = 1
        };
        _messageRepositoryMock.Setup(x => x.SendMessageAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.SendMessageAsync(request), Times.Once);
    }

    [Fact]
    public async Task SendMessage_NoRecipient_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            Message = "Test message",
            SendToCourierId = null,
            SendToStaffId = null
        };

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("Must specify exactly one recipient (either SendToCourierId or SendToStaffId)");
        _messageRepositoryMock.Verify(x => x.SendMessageAsync(It.IsAny<SendMessageRequest>()), Times.Never);
    }

    [Fact]
    public async Task SendMessage_BothRecipients_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            Message = "Test message",
            SendToCourierId = 1,
            SendToStaffId = 2
        };

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("Must specify exactly one recipient (either SendToCourierId or SendToStaffId)");
        _messageRepositoryMock.Verify(x => x.SendMessageAsync(It.IsAny<SendMessageRequest>()), Times.Never);
    }

    [Fact]
    public async Task SendMessage_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new SendMessageRequest
        {
            Message = "Test message",
            SendToCourierId = 1
        };
        _messageRepositoryMock.Setup(x => x.SendMessageAsync(request))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region SendMultiMessage Tests

    [Fact]
    public async Task SendMultiMessage_ValidCourierRecipients_ReturnsOk()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([1], [1, 2, 3])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.Setup(x => x.SendMultipleMessagesAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.SendMultipleMessagesAsync(request), Times.Once);
    }

    [Fact]
    public async Task SendMultiMessage_ValidStaffRecipients_ReturnsOk()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([1, 2], [])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.Setup(x => x.SendMultipleMessagesAsync(request))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.SendMultipleMessagesAsync(request), Times.Once);
    }

    [Fact]
    public async Task SendMultiMessage_NoRecipients_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([], [])
        {
            Message = "Test message"
        };

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("Must specify at least one recipient (either SendToCourierIds or SendToStaffIds)");
        _messageRepositoryMock.Verify(x => x.SendMultipleMessagesAsync(It.IsAny<SendMultipleMessageRequest>()), Times.Never);
    }

    [Fact]
    public async Task SendMultiMessage_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([], [1])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.Setup(x => x.SendMultipleMessagesAsync(request))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region MarkMessagesAsRead Tests

    [Fact]
    public async Task MarkMessagesAsRead_ValidCourierParty_ReturnsOk()
    {
        // Arrange
        const int otherPartyId = 1;
        const OtherMessagePartyType partyType = OtherMessagePartyType.Courier;
        _messageRepositoryMock.Setup(x => x.MarkMessagesAsReadAsync(otherPartyId, partyType))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(otherPartyId, partyType);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.MarkMessagesAsReadAsync(otherPartyId, partyType), Times.Once);
    }

    [Fact]
    public async Task MarkMessagesAsRead_ValidStaffParty_ReturnsOk()
    {
        // Arrange
        const int otherPartyId = 1;
        const OtherMessagePartyType partyType = OtherMessagePartyType.Staff;
        _messageRepositoryMock.Setup(x => x.MarkMessagesAsReadAsync(otherPartyId, partyType))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(otherPartyId, partyType);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.MarkMessagesAsReadAsync(otherPartyId, partyType), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task MarkMessagesAsRead_InvalidOtherPartyId_ReturnsBadRequest(int invalidId)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(invalidId, OtherMessagePartyType.Courier);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("Invalid otherPartyId");
        _messageRepositoryMock.Verify(x => x.MarkMessagesAsReadAsync(It.IsAny<int>(), It.IsAny<OtherMessagePartyType>()), Times.Never);
    }

    [Fact]
    public async Task MarkMessagesAsRead_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.MarkMessagesAsReadAsync(It.IsAny<int>(), It.IsAny<OtherMessagePartyType>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(1, OtherMessagePartyType.Courier);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetQuickResponses Tests

    [Fact]
    public async Task GetQuickResponses_Success_ReturnsJsonWithResponses()
    {
        // Arrange
        var expectedResponses = new List<Suggestion>
        {
            new() { Id = 1, Text = "On my way" },
            new() { Id = 2, Text = "Running late" }
        };
        _messageRepositoryMock.Setup(x => x.GetSavedQuickResponsesAsync())
            .ReturnsAsync(expectedResponses);

        var controller = CreateController();

        // Act
        var result = await controller.GetQuickResponses();

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().BeEquivalentTo(expectedResponses);
    }

    [Fact]
    public async Task GetQuickResponses_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetSavedQuickResponsesAsync())
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetQuickResponses();

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region AddQuickResponse Tests

    [Fact]
    public async Task AddQuickResponse_ValidRequest_ReturnsJsonWithNewId()
    {
        // Arrange
        var request = new SaveQuickResponseRequest { Message = "New quick response" };
        const int expectedId = 123;
        _messageRepositoryMock.Setup(x => x.AddNewQuickResponseAsync(request))
            .ReturnsAsync(expectedId);

        var controller = CreateController();

        // Act
        var result = await controller.AddQuickResponse(request);

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().Be(expectedId);
    }

    [Fact]
    public async Task AddQuickResponse_NullMessage_Returns500()
    {
        // Arrange
        var request = new SaveQuickResponseRequest { Message = null! };

        var controller = CreateController();

        // Act
        var result = await controller.AddQuickResponse(request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddQuickResponse_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new SaveQuickResponseRequest { Message = "Test" };
        _messageRepositoryMock.Setup(x => x.AddNewQuickResponseAsync(request))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AddQuickResponse(request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region DeleteQuickResponse Tests

    [Fact]
    public async Task DeleteQuickResponse_ValidId_ReturnsOk()
    {
        // Arrange
        const int responseId = 1;
        _messageRepositoryMock.Setup(x => x.DeleteQuickResponseAsync(responseId))
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteQuickResponse(responseId);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.DeleteQuickResponseAsync(responseId), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public async Task DeleteQuickResponse_InvalidId_ReturnsBadRequest(int invalidId)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.DeleteQuickResponse(invalidId);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("Invalid otherPartyId");
        _messageRepositoryMock.Verify(x => x.DeleteQuickResponseAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task DeleteQuickResponse_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.DeleteQuickResponseAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.DeleteQuickResponse(1);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetMessageContactOptions Tests

    [Fact]
    public async Task GetMessageContactOptions_ValidSearchTerm_ReturnsJsonWithResults()
    {
        // Arrange
        const string searchTerm = "John";
        var expectedResults = new List<MessageContactOptionViewModel>
        {
            new() { Id = Guid.NewGuid(), RecordId = 1, Name = "John Doe" },
            new() { Id = Guid.NewGuid(), RecordId = 2, Name = "John Smith" }
        };
        _messageRepositoryMock.Setup(x => x.GetNewMessageContactOptionsAsync(searchTerm))
            .ReturnsAsync(expectedResults);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessageContactOptions(searchTerm);

        // Assert
        var jsonResult = result.Should().BeOfType<JsonResult>().Subject;
        jsonResult.Value.Should().BeEquivalentTo(expectedResults);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task GetMessageContactOptions_EmptySearchTerm_ReturnsOk(string? searchTerm)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetMessageContactOptions(searchTerm!);

        // Assert
        result.Should().BeOfType<OkResult>();
        _messageRepositoryMock.Verify(x => x.GetNewMessageContactOptionsAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetMessageContactOptions_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.Setup(x => x.GetNewMessageContactOptionsAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessageContactOptions("test");

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion
}
