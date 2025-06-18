using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class MessageRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IMessageHelperService messageHelper) : BaseRepository(contextFactory), IMessageRepository
{
    public async Task<int> GetUnreadMessageCountAsync()
    {
        var currentStaffId = infoService.GetStaffId();

        var unreadCount = await Context.TucManualMessages
            .UnreadForStaff(currentStaffId)
            .AsNoTracking()
            .CountAsync();

        return unreadCount;
    }
    
    public async Task<List<RecentMessageViewModel>> GetRecentListAsync()
    {
        var staffId = infoService.GetStaffId();
        var currentDate = infoService.GetCurrentTenantTime();

        var allMessages = await Context.TucManualMessages
            .ForStaff(staffId)
            .IncludeParticipants()
            .ToListAsync();

        // Group by other party and build result using helper service
        var result = allMessages
            .Select(m => new
            {
                Message = m,
                OtherParty = messageHelper.GetOtherParty(m, staffId),
                IsIncoming = messageHelper.IsIncomingMessage(m, staffId)
            })
            .Where(x => x.OtherParty.Id > 0)
            .GroupBy(x => new { x.OtherParty.Id, x.OtherParty.Type })
            .Select(g =>
            {
                var latestMessage = g.OrderByDescending(x => x.Message.UcmmDate).First();

                return new RecentMessageViewModel
                {
                    OtherPartyId = latestMessage.OtherParty.Id,
                    OtherPartyType = latestMessage.OtherParty.Type,
                    OtherPartyName = latestMessage.OtherParty.Name,
                    OtherPartyInitials = latestMessage.OtherParty.Initials,
                    OtherPartyStatus = messageHelper.GetCourierStatus(
                        latestMessage.OtherParty.Type == OtherMessagePartyType.Courier
                            ? GetCourierFromMessage(latestMessage.Message, latestMessage.OtherParty.Id)
                            : null,
                        currentDate),
                    UnreadCount = g.Count(x => x.IsIncoming && !x.Message.Read),
                    LastMessage = latestMessage.Message.UcmmMessage,
                    LastMessageTime = latestMessage.Message.UcmmDate
                };
            })
            .OrderByDescending(x => x.LastMessageTime)
            .ToList();

        return result;
    }

    public async Task<List<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId)
    {
        var messages = await Context.TucManualMessages
            .BetweenStaffAndCourier(staffId, courierId)
            .OrderBy(m => m.UcmmDate)
            .Select(m => new ChatMessageViewModel
            {
                MessageId = m.UcmmId,
                SendFromStaffId = m.UcmmSendFromStaffId,
                SendToStaffId = m.UcmmSendToStaffId,
                SendFromCourierId = m.UcmmSendFromCourierId,
                SendToCourierId = m.UcmmSendToCourierId,
                Message = m.UcmmMessage,
                MessageTime = m.UcmmTimeSent ?? m.UcmmDate,
                Read = m.Read,
                ReadTime = m.TimeRead,
                Sent = m.UcmmSent,
                IsSender = m.UcmmSendFromStaffId == staffId
            })
            .ToListAsync();

        return messages;
    }

    public async Task<List<ChatMessageViewModel>> GetMessagesByStaffIdAsync(int otherStaffId, int currentStaffId)
    {
        var messages = await Context.TucManualMessages
            .BetweenStaff(currentStaffId, otherStaffId)
            .OrderBy(m => m.UcmmDate)
            .Select(m => new ChatMessageViewModel
            {
                MessageId = m.UcmmId,
                SendFromStaffId = m.UcmmSendFromStaffId,
                SendToStaffId = m.UcmmSendToStaffId,
                SendFromCourierId = m.UcmmSendFromCourierId,
                SendToCourierId = m.UcmmSendToCourierId,
                Message = m.UcmmMessage,
                MessageTime = m.UcmmTimeSent ?? m.UcmmDate,
                Read = m.Read,
                ReadTime = m.TimeRead,
                Sent = m.UcmmSent,
                IsSender = m.UcmmSendFromStaffId == currentStaffId
            })
            .ToListAsync();

        return messages;
    }

    public async Task SendMessageAsync(SendMessageRequest request)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var staffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();

        // Validate that exactly one recipient is specified
        if ((request.SendToStaffId.HasValue ? 1 : 0) + (request.SendToCourierId.HasValue ? 1 : 0) != 1)
        {
            throw new ArgumentException("Must specify exactly one recipient (either SendToStaffId or SendToCourierId)");
        }
        
        ArgumentException.ThrowIfNullOrEmpty(request.Message);
        
        var message = new TucManualMessage
        {
            UcmmDate = currentDate,
            UcmmSendFromStaffId = staffId,
            UcmmAttempts = 0,
            UcmmMessage = request.Message
        };

        if (request.SendToCourierId.HasValue)
        {
            await HandleCourierMessageAsync(message, request.SendToCourierId.Value, request.MessageType, isUsTenant, currentDate.Date);
        }
        else if (request.SendToStaffId.HasValue)
        {
            await HandleStaffMessageAsync(message, request.SendToStaffId.Value);
        }

        await Context.TucManualMessages.AddAsync(message);
        await Context.SaveChangesAsync();
    }

    public async Task SendMultipleMessagesAsync(SendMultipleMessageRequest request)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var currentStaffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();
        List<TucManualMessage> messages = [];
        
        foreach (var courierId in request.SendToCourierIds)
        {
            var message = new TucManualMessage
            {
                UcmmDate = currentDate,
                UcmmSendFromStaffId = currentStaffId,
                UcmmAttempts = 0,
                UcmmMessage = request.Message
            };
            
            await HandleCourierMessageAsync(message, courierId, request.MessageType, isUsTenant, currentDate.Date);
            messages.Add(message);
        }

        foreach (var staffId in request.SendToStaffIds)
        {
            var message = new TucManualMessage
            {
                UcmmDate = currentDate,
                UcmmSendFromStaffId = currentStaffId,
                UcmmAttempts = 0,
                UcmmMessage = request.Message
            };
            
            await HandleStaffMessageAsync(message, staffId);
            messages.Add(message);
        }

        await Context.TucManualMessages.AddRangeAsync(messages);
        await Context.SaveChangesAsync();
    }

    public async Task MarkMessagesAsReadAsync(int otherPartyId, OtherMessagePartyType otherPartyType)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var currentStaffId = infoService.GetStaffId();

        var query = Context.TucManualMessages.UnreadForStaff(currentStaffId);

        // Filter by another party type
        query = otherPartyType == OtherMessagePartyType.Courier
            ? query.Where(m => m.UcmmSendFromCourierId == otherPartyId)
            : query.Where(m => m.UcmmSendFromStaffId == otherPartyId);

        var messages = await query.ToListAsync();

        foreach (var message in messages)
        {
            message.Read = true;
            message.TimeRead = currentDate;
        }

        await Context.SaveChangesAsync();
    }

    public async Task<List<Suggestion>> GetSavedQuickResponsesAsync()
    {
        var staffId = infoService.GetStaffId();

        var quickResponses = await Context.UserQuickResponses
            .Where(r => r.StaffId == staffId && r.IsActive == true)
            .Select(r => new Suggestion
            {
                Id = r.ResponseId,
                Text = r.Message
            })
            .AsNoTracking()
            .ToListAsync();

        return quickResponses;
    }

    public async Task<int> AddNewQuickResponseAsync(SaveQuickResponseRequest data)
    {
        var staffId = infoService.GetStaffId();
        var response = new UserQuickResponse
        {
            StaffId = staffId,
            Message = data.Message,
            IsActive = true
        };

        await Context.UserQuickResponses.AddAsync(response);
        await Context.SaveChangesAsync();

        return response.ResponseId;
    }

    public async Task DeleteQuickResponseAsync(int responseId)
    {
        var staffId = infoService.GetStaffId();
        var response =
            await Context.UserQuickResponses.FirstOrDefaultAsync(r =>
                r.StaffId == staffId && r.ResponseId == responseId);
        ArgumentNullException.ThrowIfNull(response);

        // Softly delete
        response.IsActive = false;
        await Context.SaveChangesAsync();
    }

    private async Task HandleCourierMessageAsync(TucManualMessage message, int sendToCourierId, int messageType, bool isUsTenant,
        DateTime currentDate)
    {
        var courierData = await (from courier in Context.TucCouriers
            where courier.UccrId == sendToCourierId && courier.Active
            join loginOut in Context.TblCourierLogInOuts
                on courier.CourierLogInOutId equals loginOut.CourierLogInOutId into loginGroup
            from login in loginGroup.DefaultIfEmpty()
            select new
            {
                CourierId = courier.UccrId,
                courier.Code,
                courier.PersonalMobile,
                courier.UccrMobile,
                IsLoggedInToday = login != null &&
                                  login.LogInTime.Date == currentDate &&
                                  !login.LogOutTime.HasValue
            }).FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(courierData);

        var deliveryMethod = GetDeliveryMethod(messageType, courierData.IsLoggedInToday);

        message.UcmmSendToCourierId = sendToCourierId;

        if (deliveryMethod == MessageDeliveryType.App)
        {
            message.Subject = "Courier Manager";
        }
        else // SMS
        {
            if (string.IsNullOrWhiteSpace(courierData.PersonalMobile) &&
                string.IsNullOrWhiteSpace(courierData.UccrMobile))
            {
                throw new ArgumentException($"Courier {courierData.Code} must have a mobile number to send SMS");
            }

            var mobileNumber = !string.IsNullOrWhiteSpace(courierData.PersonalMobile)
                ? courierData.PersonalMobile
                : courierData.UccrMobile;

            message.SendToMobile = NormalizeMobileNumber(mobileNumber, isUsTenant);
            message.Subject = $"SMS to Courier: {courierData.Code}";
        }
    }
    
    public async Task<List<MessageContactOptionViewModel>> GetNewMessageContactOptionsAsync(string searchTerm)
    {
        var currentDate = infoService.GetCurrentTenantTime();
            var couriers = await Context
                .TucCouriers.Where(c =>
                    c.Active == true
                    && (c.Code + " " + c.UccrName + " " + c.UccrSurname).Contains(searchTerm)
                )
                .OrderBy(c => c.Code)
                .Select(c => new MessageContactOptionViewModel
                {
                    Id = Guid.NewGuid(),
                    RecordId = c.UccrId,
                    Name = $"{c.UccrName} {c.UccrSurname}",
                    OtherMessagePartyType = OtherMessagePartyType.Courier,
                    Status = c.CourierLogInOut.LogOutTime != null && c.CourierLogInOut.LogOutTime < currentDate ? "online" : "offline"
                })
                .AsNoTracking()
                .ToListAsync();
            
            var staff = await Context.TucStaffs
                .Where(s => s.UcstActive == true && (s.UcstFirstName + " " + s.UcstLastName).Contains(searchTerm))
                .OrderBy(s => s.UcstFirstName)
                .Select(s => new MessageContactOptionViewModel
                {
                    Id = Guid.NewGuid(),
                    RecordId = s.UcstId,
                    Name = $"{s.UcstFirstName} {s.UcstLastName}",
                    OtherMessagePartyType = OtherMessagePartyType.Staff,
                    Status = "unknown"
                })
                .AsNoTracking()
                .ToListAsync();
            
            var results = couriers.Concat(staff).ToList();
            return results;
    }

    private async Task HandleStaffMessageAsync(TucManualMessage message, int sendToStaffId)
    {
        var staffExists = await Context.TucStaffs
            .AnyAsync(s => s.UcstId == sendToStaffId && s.UcstActive);

        ArgumentNullException.ThrowIfNull(staffExists);

        message.UcmmSendToStaffId = sendToStaffId;
        message.Subject = "Staff Message";
    }

    private static TucCourier GetCourierFromMessage(TucManualMessage message, int courierId)
    {
        return message.UcmmSendFromCourierId == courierId
            ? message.UcmmSendFromCourier
            : message.UcmmSendToCourier;
    }

    private static MessageDeliveryType GetDeliveryMethod(int messageType, bool isLoggedInToday)
    {
        return messageType switch
        {
            1 => MessageDeliveryType.App,
            2 => MessageDeliveryType.Sms,
            3 => isLoggedInToday ? MessageDeliveryType.App : MessageDeliveryType.Sms,
            _ => throw new ArgumentException($"Invalid message type: {messageType}")
        };
    }

    private static string NormalizeMobileNumber(string phoneNumber, bool isUsTenant)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            return phoneNumber;

        var normalized = phoneNumber.Replace(" ", string.Empty);

        return isUsTenant ? normalized.Replace("+1", string.Empty) : normalized.Replace("+64", "0");
    }
}