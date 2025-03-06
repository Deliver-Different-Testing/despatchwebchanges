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
        [FromQuery] int eventId,
        [FromQuery] bool closed
    )
    {
        try
        {
            await taskRepository.SetEventAsClosed(eventId, closed);
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
        [FromQuery] int eventId,
        [FromQuery] DateTime date
    )
    {
        try
        {
            await taskRepository.UpdateEventDate(eventId, date);
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
        [FromQuery] int eventId,
        [FromQuery] DateTime time
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
}
