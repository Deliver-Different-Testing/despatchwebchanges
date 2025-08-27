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
    public async Task<IActionResult> MarkTaskAsClosed(int eventId, bool closed)
    {
        try
        {
            await taskRepository.SetEventAsClosedAsync(eventId, closed);
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
    public async Task<IActionResult> UpdateTaskDate(int eventId, string date)
    {
        try
        {
            await taskRepository.UpdateEventDateAsync(eventId, date);
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
    public async Task<IActionResult> UpdateTaskTime(int eventId, string time)
    {
        try
        {
            await taskRepository.UpdateEventTimeAsync(eventId, time);
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
    public async Task<IActionResult> ReassignTask(int eventId, int staffId)
    {
        try
        {
            await taskRepository.ReassignEventToUserAsync(eventId, staffId);
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