using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class TaskControllerTests
{
    private readonly ITaskRepository _taskRepoMock = Substitute.For<ITaskRepository>();

    private TaskController CreateController() => new(_taskRepoMock);

    [Fact]
    public async Task GetAllTasks_Success_ReturnsJson()
    {
        var filters = new TaskTableFiltersRequest();
        var expected = new List<TaskViewModel> { new() };
        _taskRepoMock.GetAllTasksAsync(filters).Returns(expected);

        var result = await CreateController().GetAllTasks(filters);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllTasks_RepositoryThrows_Returns500()
    {
        _taskRepoMock.GetAllTasksAsync(Arg.Any<TaskTableFiltersRequest>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllTasks(new TaskTableFiltersRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task MarkTaskAsClosed_Success_ReturnsOk()
    {
        var request = new TaskCloseRequest { EventId = 1, Closed = true };
        _taskRepoMock.SetEventAsClosedAsync(1, true).Returns(Task.CompletedTask);

        var result = await CreateController().MarkTaskAsClosed(request);

        Assert.IsType<OkResult>(result);
        await _taskRepoMock.Received().SetEventAsClosedAsync(1, true);
    }

    [Fact]
    public async Task MarkTaskAsClosed_RepositoryThrows_Returns500()
    {
        _taskRepoMock.SetEventAsClosedAsync(Arg.Any<int>(), Arg.Any<bool>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().MarkTaskAsClosed(new TaskCloseRequest { EventId = 1, Closed = true });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task UpdateTaskDate_Success_ReturnsOk()
    {
        var date = DateTimeOffset.Now;
        var request = new TaskDateRequest { EventId = 1, Date = date };
        _taskRepoMock.UpdateEventDueTimeAsync(1, date).Returns(Task.CompletedTask);

        var result = await CreateController().UpdateTaskDate(request);

        Assert.IsType<OkResult>(result);
        await _taskRepoMock.Received().UpdateEventDueTimeAsync(1, date);
    }

    [Fact]
    public async Task UpdateTaskDate_RepositoryThrows_Returns500()
    {
        _taskRepoMock.UpdateEventDueTimeAsync(Arg.Any<int>(), Arg.Any<DateTimeOffset>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().UpdateTaskDate(new TaskDateRequest { EventId = 1 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task UpdateTaskTime_Success_ReturnsOk()
    {
        var time = DateTimeOffset.Now;
        var request = new TaskTimeRequest { EventId = 1, Time = time };
        _taskRepoMock.UpdateEventDueTimeAsync(1, time).Returns(Task.CompletedTask);

        var result = await CreateController().UpdateTaskTime(request);

        Assert.IsType<OkResult>(result);
    }

    [Fact]
    public async Task UpdateTaskTime_RepositoryThrows_Returns500()
    {
        _taskRepoMock.UpdateEventDueTimeAsync(Arg.Any<int>(), Arg.Any<DateTimeOffset>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().UpdateTaskTime(new TaskTimeRequest { EventId = 1 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetEventGroups_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Group A" } };
        _taskRepoMock.GetEventGroupsAsync().Returns(expected);

        var result = await CreateController().GetEventGroups();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetEventGroups_RepositoryThrows_Returns500()
    {
        _taskRepoMock.GetEventGroupsAsync().ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetEventGroups();

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetEventTypeGroups_Success_ReturnsJson()
    {
        var expected = new List<EventGroupViewModel> { new() };
        _taskRepoMock.GetEventTypeGroupsAsync(5).Returns(expected);

        var result = await CreateController().GetEventTypeGroups(5);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetEventTypeGroups_RepositoryThrows_Returns500()
    {
        _taskRepoMock.GetEventTypeGroupsAsync(Arg.Any<int>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetEventTypeGroups(5);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task AddTasks_Success_ReturnsOk()
    {
        var request = new AddTasksRequest { JobId = 1, EventGroupViewModels = [new EventGroupViewModel()] };
        _taskRepoMock.CreateEventsForJobAsync(1, request.EventGroupViewModels)
            .Returns(Task.CompletedTask);

        var result = await CreateController().AddTasks(request);

        Assert.IsType<OkResult>(result);
        await _taskRepoMock.Received().CreateEventsForJobAsync(1, request.EventGroupViewModels);
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
        _taskRepoMock.CreateEventsForJobAsync(Arg.Any<int>(), Arg.Any<List<EventGroupViewModel>>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().AddTasks(new AddTasksRequest { JobId = 1, EventGroupViewModels = [] });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetStaff_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "John" } };
        _taskRepoMock.GetActiveStaffAsync().Returns(expected);

        var result = await CreateController().GetStaff();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetStaff_RepositoryThrows_Returns500()
    {
        _taskRepoMock.GetActiveStaffAsync().ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetStaff();

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task ReassignTask_Success_ReturnsOk()
    {
        var request = new TaskAssignStaffRequest { EventId = 1, StaffId = 5 };
        _taskRepoMock.ReassignEventToUserAsync(1, 5).Returns(Task.CompletedTask);

        var result = await CreateController().ReassignTask(request);

        Assert.IsType<OkResult>(result);
        await _taskRepoMock.Received().ReassignEventToUserAsync(1, 5);
    }

    [Fact]
    public async Task ReassignTask_RepositoryThrows_Returns500()
    {
        _taskRepoMock.ReassignEventToUserAsync(Arg.Any<int>(), Arg.Any<int>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().ReassignTask(new TaskAssignStaffRequest { EventId = 1, StaffId = 5 });

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
