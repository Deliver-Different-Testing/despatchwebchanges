using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(MessagesController))]
public class MessagesControllerTests
{
    private readonly IMessageRepository _messageRepositoryMock = Substitute.For<IMessageRepository>();

    private MessagesController CreateController() => new(_messageRepositoryMock);

    [Fact]
    public async Task GetUnreadMessageCount_Success_ReturnsJsonWithCount()
    {
        // Arrange
        const int expectedCount = 5;
        _messageRepositoryMock.GetUnreadMessageCountAsync().Returns(expectedCount);

        var controller = CreateController();

        // Act
        var result = await controller.GetUnreadMessageCount();

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCount, jsonResult.Value);
    }

    [Fact]
    public async Task GetUnreadMessageCount_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetUnreadMessageCountAsync().ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetUnreadMessageCount();

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
        Assert.Equal("Database error", statusCodeResult.Value);
    }

    [Fact]
    public async Task GetRecentList_Success_ReturnsJsonWithRecents()
    {
        // Arrange
        var expectedRecents = new List<RecentMessageViewModel>
        {
            new() { OtherPartyName = "Courier 1", UnreadCount = 2, LastMessage = "Hello" },
            new() { OtherPartyName = "Staff 1", UnreadCount = 0, LastMessage = "Hi there" }
        };
        _messageRepositoryMock.GetRecentListAsync()
            .Returns(expectedRecents);

        var controller = CreateController();

        // Act
        var result = await controller.GetRecentList();

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedRecents, jsonResult.Value);
    }

    [Fact]
    public async Task GetRecentList_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetRecentListAsync().ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetRecentList();

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

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
        _messageRepositoryMock.GetMessagesByCourierIdAsync(courierId, staffId)
            .Returns(expectedMessages);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessages(courierId, staffId);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedMessages, jsonResult.Value);
    }

    [Fact]
    public async Task GetMessages_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetMessagesByCourierIdAsync(Arg.Any<int>(), Arg.Any<int>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessages(1, 2);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

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
        _messageRepositoryMock.GetMessagesByStaffIdAsync(otherStaffId, currentStaffId)
            .Returns(expectedMessages);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessagesByStaff(otherStaffId, currentStaffId);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedMessages, jsonResult.Value);
    }

    [Fact]
    public async Task GetMessagesByStaff_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetMessagesByStaffIdAsync(Arg.Any<int>(), Arg.Any<int>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessagesByStaff(1, 2);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

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
        _messageRepositoryMock.SendMessageAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().SendMessageAsync(request);
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
        _messageRepositoryMock.SendMessageAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().SendMessageAsync(request);
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
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Must specify exactly one recipient (either SendToCourierId or SendToStaffId)", badRequestResult.Value);
        await _messageRepositoryMock.Received(0).SendMessageAsync(Arg.Any<SendMessageRequest>());
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
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Must specify exactly one recipient (either SendToCourierId or SendToStaffId)", badRequestResult.Value);
        await _messageRepositoryMock.DidNotReceive().SendMessageAsync(Arg.Any<SendMessageRequest>());
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
        _messageRepositoryMock.SendMessageAsync(request).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.SendMessage(request);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task SendMultiMessage_ValidCourierRecipients_ReturnsOk()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([1], [1, 2, 3])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.SendMultipleMessagesAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().SendMultipleMessagesAsync(request);
    }

    [Fact]
    public async Task SendMultiMessage_ValidStaffRecipients_ReturnsOk()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([1, 2], [])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.SendMultipleMessagesAsync(request)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().SendMultipleMessagesAsync(request);
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
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Must specify at least one recipient (either SendToCourierIds or SendToStaffIds)", badRequestResult.Value);
        await _messageRepositoryMock.DidNotReceive().SendMultipleMessagesAsync(Arg.Any<SendMultipleMessageRequest>());
    }

    [Fact]
    public async Task SendMultiMessage_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new SendMultipleMessageRequest([], [1])
        {
            Message = "Test message"
        };
        _messageRepositoryMock.SendMultipleMessagesAsync(request).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.SendMultiMessage(request);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task MarkMessagesAsRead_ValidCourierParty_ReturnsOk()
    {
        // Arrange
        const int otherPartyId = 1;
        const OtherMessagePartyType partyType = OtherMessagePartyType.Courier;
        _messageRepositoryMock.MarkMessagesAsReadAsync(otherPartyId, partyType)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(otherPartyId, partyType);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().MarkMessagesAsReadAsync(otherPartyId, partyType);
    }

    [Fact]
    public async Task MarkMessagesAsRead_ValidStaffParty_ReturnsOk()
    {
        // Arrange
        const int otherPartyId = 1;
        const OtherMessagePartyType partyType = OtherMessagePartyType.Staff;
        _messageRepositoryMock.MarkMessagesAsReadAsync(otherPartyId, partyType)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(otherPartyId, partyType);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().MarkMessagesAsReadAsync(otherPartyId, partyType);
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
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Invalid otherPartyId", badRequestResult.Value);
        await _messageRepositoryMock.DidNotReceive().MarkMessagesAsReadAsync(Arg.Any<int>(), Arg.Any<OtherMessagePartyType>());
    }

    [Fact]
    public async Task MarkMessagesAsRead_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.MarkMessagesAsReadAsync(Arg.Any<int>(), Arg.Any<OtherMessagePartyType>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.MarkMessagesAsRead(1, OtherMessagePartyType.Courier);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task GetQuickResponses_Success_ReturnsJsonWithResponses()
    {
        // Arrange
        var expectedResponses = new List<Suggestion>
        {
            new() { Id = 1, Text = "On my way" },
            new() { Id = 2, Text = "Running late" }
        };
        _messageRepositoryMock.GetSavedQuickResponsesAsync()
            .Returns(expectedResponses);

        var controller = CreateController();

        // Act
        var result = await controller.GetQuickResponses();

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedResponses, jsonResult.Value);
    }

    [Fact]
    public async Task GetQuickResponses_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetSavedQuickResponsesAsync().ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetQuickResponses();

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task AddQuickResponse_ValidRequest_ReturnsJsonWithNewId()
    {
        // Arrange
        var request = new SaveQuickResponseRequest { Message = "New quick response" };
        const int expectedId = 123;
        _messageRepositoryMock.AddNewQuickResponseAsync(request)
            .Returns(expectedId);

        var controller = CreateController();

        // Act
        var result = await controller.AddQuickResponse(request);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedId, jsonResult.Value);
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
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task AddQuickResponse_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new SaveQuickResponseRequest { Message = "Test" };
        _messageRepositoryMock.AddNewQuickResponseAsync(request).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AddQuickResponse(request);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

    [Fact]
    public async Task DeleteQuickResponse_ValidId_ReturnsOk()
    {
        // Arrange
        const int responseId = 1;
        _messageRepositoryMock.DeleteQuickResponseAsync(responseId)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.DeleteQuickResponse(responseId);

        // Assert
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.Received().DeleteQuickResponseAsync(responseId);
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
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Invalid otherPartyId", badRequestResult.Value);
        await _messageRepositoryMock.DidNotReceive().DeleteQuickResponseAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task DeleteQuickResponse_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.DeleteQuickResponseAsync(Arg.Any<int>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.DeleteQuickResponse(1);

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }

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
        _messageRepositoryMock.GetNewMessageContactOptionsAsync(searchTerm)
            .Returns(expectedResults);

        var controller = CreateController();

        // Act
        var result = await controller.GetMessageContactOptions(searchTerm);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expectedResults, jsonResult.Value);
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
        Assert.IsType<OkResult>(result);
        await _messageRepositoryMock.DidNotReceive().GetNewMessageContactOptionsAsync(Arg.Any<string>());
    }

    [Fact]
    public async Task GetMessageContactOptions_RepositoryThrows_Returns500()
    {
        // Arrange
        _messageRepositoryMock.GetNewMessageContactOptionsAsync(Arg.Any<string>()).ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetMessageContactOptions("test");

        // Assert
        var statusCodeResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, statusCodeResult.StatusCode);
    }
}
