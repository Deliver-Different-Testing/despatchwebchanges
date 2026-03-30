using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class TaskControllerTests
{
    private readonly Mock<ITaskRepository> _taskRepoMock = new();

    private TaskController CreateController() => new(_taskRepoMock.Object);

    [Fact]
    public async Task GetAllTasks_Success_ReturnsJson()
    {
        var filters = new TaskTableFiltersRequest();
        var expected = new List<TaskViewModel> { new() };
        _taskRepoMock.Setup(x => x.GetAllTasksAsync(filters)).ReturnsAsync(expected);

        var result = await CreateController().GetAllTasks(filters);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllTasks_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.GetAllTasksAsync(It.IsAny<TaskTableFiltersRequest>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllTasks(new TaskTableFiltersRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task MarkTaskAsClosed_Success_ReturnsOk()
    {
        var request = new TaskCloseRequest { EventId = 1, Closed = true };
        _taskRepoMock.Setup(x => x.SetEventAsClosedAsync(1, true)).Returns(Task.CompletedTask);

        var result = await CreateController().MarkTaskAsClosed(request);

        Assert.IsType<OkResult>(result);
        _taskRepoMock.Verify(x => x.SetEventAsClosedAsync(1, true), Times.Once);
    }

    [Fact]
    public async Task MarkTaskAsClosed_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.SetEventAsClosedAsync(It.IsAny<int>(), It.IsAny<bool>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().MarkTaskAsClosed(new TaskCloseRequest { EventId = 1, Closed = true });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task UpdateTaskDate_Success_ReturnsOk()
    {
        var date = DateTimeOffset.Now;
        var request = new TaskDateRequest { EventId = 1, Date = date };
        _taskRepoMock.Setup(x => x.UpdateEventDueTimeAsync(1, date)).Returns(Task.CompletedTask);

        var result = await CreateController().UpdateTaskDate(request);

        Assert.IsType<OkResult>(result);
        _taskRepoMock.Verify(x => x.UpdateEventDueTimeAsync(1, date), Times.Once);
    }

    [Fact]
    public async Task UpdateTaskDate_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.UpdateEventDueTimeAsync(It.IsAny<int>(), It.IsAny<DateTimeOffset>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().UpdateTaskDate(new TaskDateRequest { EventId = 1 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task UpdateTaskTime_Success_ReturnsOk()
    {
        var time = DateTimeOffset.Now;
        var request = new TaskTimeRequest { EventId = 1, Time = time };
        _taskRepoMock.Setup(x => x.UpdateEventDueTimeAsync(1, time)).Returns(Task.CompletedTask);

        var result = await CreateController().UpdateTaskTime(request);

        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateTaskTime_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.UpdateEventDueTimeAsync(It.IsAny<int>(), It.IsAny<DateTimeOffset>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().UpdateTaskTime(new TaskTimeRequest { EventId = 1 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetEventGroups_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Group A" } };
        _taskRepoMock.Setup(x => x.GetEventGroupsAsync()).ReturnsAsync(expected);

        var result = await CreateController().GetEventGroups();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetEventGroups_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.GetEventGroupsAsync())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetEventGroups();

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetEventTypeGroups_Success_ReturnsJson()
    {
        var expected = new List<EventGroupViewModel> { new() };
        _taskRepoMock.Setup(x => x.GetEventTypeGroupsAsync(5)).ReturnsAsync(expected);

        var result = await CreateController().GetEventTypeGroups(5);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetEventTypeGroups_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.GetEventTypeGroupsAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetEventTypeGroups(5);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task AddTasks_Success_ReturnsOk()
    {
        var request = new AddTasksRequest { JobId = 1, EventGroupViewModels = [new()] };
        _taskRepoMock.Setup(x => x.CreateEventsForJobAsync(1, request.EventGroupViewModels))
            .Returns(Task.CompletedTask);

        var result = await CreateController().AddTasks(request);

        Assert.IsType<OkResult>(result);
        _taskRepoMock.Verify(x => x.CreateEventsForJobAsync(1, request.EventGroupViewModels), Times.Once);
    }

    [Fact]
    public async Task AddTasks_NullRequest_Returns500()
    {
        var result = await CreateController().AddTasks(null!);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task AddTasks_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.CreateEventsForJobAsync(It.IsAny<int>(), It.IsAny<List<EventGroupViewModel>>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().AddTasks(new AddTasksRequest { JobId = 1, EventGroupViewModels = [] });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetStaff_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "John" } };
        _taskRepoMock.Setup(x => x.GetActiveStaffAsync()).ReturnsAsync(expected);

        var result = await CreateController().GetStaff();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetStaff_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.GetActiveStaffAsync())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetStaff();

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task ReassignTask_Success_ReturnsOk()
    {
        var request = new TaskAssignStaffRequest { EventId = 1, StaffId = 5 };
        _taskRepoMock.Setup(x => x.ReassignEventToUserAsync(1, 5)).Returns(Task.CompletedTask);

        var result = await CreateController().ReassignTask(request);

        Assert.IsType<OkResult>(result);
        _taskRepoMock.Verify(x => x.ReassignEventToUserAsync(1, 5), Times.Once);
    }

    [Fact]
    public async Task ReassignTask_RepositoryThrows_Returns500()
    {
        _taskRepoMock.Setup(x => x.ReassignEventToUserAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().ReassignTask(new TaskAssignStaffRequest { EventId = 1, StaffId = 5 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
