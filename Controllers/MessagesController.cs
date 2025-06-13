using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class MessagesController(IMessageRepository messageRepository) : Controller
{
    [HttpGet]
    public async Task<IActionResult> GetRecentList(int staffId)
    {
        try
        {
            var recents = await messageRepository.GetRecentListAsync(staffId);
            return Json(recents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting recent messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetMessages(int courierId, int staffId)
    {
        try
        {
            var messages = await messageRepository.GetMessagesByCourierIdAsync(courierId, staffId);
            return Json(messages);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            ArgumentNullException.ThrowIfNull(request.CourierIds);
            
            await messageRepository.SendMessageToCouriersAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error sending messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }
}