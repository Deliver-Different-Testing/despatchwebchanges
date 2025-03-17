using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class TaskController(ITaskRepository taskRepository) : Controller
{
    [HttpGet]
    public async Task<IActionResult> GetAllTasks([FromQuery] TaskTableFiltersRequest filters)
    {
        try
        {
            var tasks = await taskRepository.GetAllTasksAsync(filters);
            return Json(tasks);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting tasks: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> MarkTaskAsClosed(
        int eventId,
        bool closed
    )
    {
        try
        {
            await taskRepository.SetEventAsClosedAsync(eventId, closed);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error marking event as closed: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTaskDate(
        int eventId,
        DateTime date
    )
    {
        try
        {
            await taskRepository.UpdateEventDateAsync(eventId, date);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating event date: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> UpdateTaskTime(
        int eventId,
        DateTime time
    )
    {
        try
        {
            await taskRepository.UpdateEventTime(eventId, time);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating event date: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetEventGroups()
    {
        try
        {
            var eventTypeGroups = await taskRepository.GetEventGroupsAsync();
            return Json(eventTypeGroups);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating event type groups: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetEventTypeGroups(int eventGroupId)
    {
        try
        {
            var eventTypeGroups = await taskRepository.GetEventTypeGroupsAsync(eventGroupId);
            return Json(eventTypeGroups);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating event type groups: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddTasks([FromBody] AddTasksRequest request)
    {
        try
        {
            if (request.EventGroupViewModels is { Count: 0 }) return BadRequest("No events provided");

            await taskRepository.CreateEventsForJobAsync(request.JobId, request.EventGroupViewModels);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error adding events for job: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetStaff()
    {
        try
        {
            var staff = await taskRepository.GetActiveStaffAsync();
            return Json(staff);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting the list of assignable staff: {Error}", ex.Message);
            return StatusCode(500);
        }
    }

    [HttpPost]
    public async Task<IActionResult> ReassignTask(int eventId, int staffId)
    {
        try
        {
            await taskRepository.ReassignEventToUser(eventId, staffId);
            return Ok();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting the list of assignable staff: {Error}", ex.Message);
            return StatusCode(500);
        }
    }
}
