using DespatchWeb.Interfaces;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class MessagesController(IMessageRepository messageRepository) : Controller
{
    public async Task<IActionResult> GetUnreadMessageCount()
    {
        try
        {
            var count = await messageRepository.GetUnreadMessageCountAsync();
            return Json(count);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting unread message count: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }    
    
    public async Task<IActionResult> GetRecentList()
    {
        try
        {
            var recents = await messageRepository.GetRecentListAsync();
            return Json(recents);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting recent messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

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

    public async Task<IActionResult> GetMessagesByStaff(int otherStaffId, int currentStaffId)
    {
        try
        {
            var messages = await messageRepository.GetMessagesByStaffIdAsync(otherStaffId, currentStaffId);
            return Json(messages);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting staff messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        try
        {
            // Validate that exactly one recipient is specified
            if ((request.SendToCourierId.HasValue ? 1 : 0) + (request.SendToStaffId.HasValue ? 1 : 0) != 1)
            {
                return BadRequest("Must specify exactly one recipient (either SendToCourierId or SendToStaffId)");
            }

            await messageRepository.SendMessageAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error sending messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }
    
    [HttpPost]
    public async Task<IActionResult> SendMultiMessage([FromBody] SendMultipleMessageRequest request)
    {
        try
        {
          if(request.SendToCourierIds.Count == 0 && request.SendToStaffIds.Count == 0)
          {
              return BadRequest("Must specify at least one recipient (either SendToCourierIds or SendToStaffIds)");
          }

          await messageRepository.SendMultipleMessagesAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error sending multiple messages: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> MarkMessagesAsRead(int otherPartyId, OtherMessagePartyType otherPartyType)
    {
        try
        {
            if (otherPartyId <= 0)
            {
                return BadRequest("Invalid otherPartyId");
            }

            await messageRepository.MarkMessagesAsReadAsync(otherPartyId, otherPartyType);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error marking messages as read: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    public async Task<IActionResult> GetQuickResponses()
    {
        try
        {
            var response = await messageRepository.GetSavedQuickResponsesAsync();
            return Json(response);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error retrieving saved quick responses");
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddQuickResponse([FromBody] SaveQuickResponseRequest data)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(data.Message);
            var newId = await messageRepository.AddNewQuickResponseAsync(data);
            return Json(newId);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error adding new quick response");
            return StatusCode(500, e.Message);
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteQuickResponse(int responseId)
    {
        try
        {
            if (responseId <= 0)
            {
                return BadRequest("Invalid otherPartyId");
            }

            await messageRepository.DeleteQuickResponseAsync(responseId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error adding new quick response");
            return StatusCode(500, e.Message);
        }
    }

    public async Task<IActionResult> GetMessageContactOptions(string searchTerm)
    {
        try
        {
            if (string.IsNullOrEmpty(searchTerm))
            {
                return Ok();
            }

            var results = await messageRepository.GetNewMessageContactOptionsAsync(searchTerm);
            return Json(results);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occured searching for message-able contacts");
            return StatusCode(500, e.Message);
        }
    }
}