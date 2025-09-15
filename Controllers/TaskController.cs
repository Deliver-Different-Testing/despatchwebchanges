using System;
using System.Threading.Tasks;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class TaskController(ITaskRepository taskRepository) : Controller
{
    public async Task<IActionResult> GetAllTasks(TaskTableFiltersRequest filters)
    {
        try
        {
            var tasks = await taskRepository.GetAllTasksAsync(filters);
            return Json(tasks);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(GetAllTasks)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> MarkTaskAsClosed([FromBody] TaskCloseRequest data)
    {
        try
        {
            await taskRepository.SetEventAsClosedAsync(data.EventId, data.Closed);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(MarkTaskAsClosed)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTaskDate([FromBody] TaskDateRequest data)
    {
        try
        {
            await taskRepository.UpdateEventDateAsync(data.EventId, data.Date);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(UpdateTaskDate)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTaskTime([FromBody] TaskTimeRequest data)
    {
        try
        {
            await taskRepository.UpdateEventTimeAsync(data.EventId, data.Time);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(UpdateTaskTime)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetEventGroups()
    {
        try
        {
            var eventTypeGroups = await taskRepository.GetEventGroupsAsync();
            return Json(eventTypeGroups);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(GetEventGroups)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetEventTypeGroups(int eventGroupId)
    {
        try
        {
            var eventTypeGroups = await taskRepository.GetEventTypeGroupsAsync(eventGroupId);
            return Json(eventTypeGroups);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(GetEventTypeGroups)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddTasks([FromBody] AddTasksRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);

            await taskRepository.CreateEventsForJobAsync(
                request.JobId,
                request.EventGroupViewModels
            );
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(AddTasks)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetStaff()
    {
        try
        {
            var staff = await taskRepository.GetActiveStaffAsync();
            return Json(staff);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(GetStaff)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReassignTask([FromBody] TaskAssignStaffRequest data)
    {
        try
        {
            await taskRepository.ReassignEventToUserAsync(data.EventId, data.StaffId);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(ex, nameof(TaskController), nameof(ReassignTask)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }
}