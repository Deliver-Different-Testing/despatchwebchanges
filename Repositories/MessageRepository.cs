using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace DespatchWeb.Repositories;

public class MessageRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IMessageHelperService messageHelper,
    IMemoryCache cache) : BaseRepository(contextFactory), IMessageRepository
{
    private readonly IDbContextFactory<DespatchContext> _contextFactory = contextFactory;

    public async Task<int> GetUnreadMessageCountAsync()
    {
        var currentStaffId = infoService.GetStaffId();
        var cacheKey = $"unread-messages:{currentStaffId}";

        // Try cache first
        if (cache.TryGetValue<int>(cacheKey, out var cachedCount)) return cachedCount;

        // Use compiled query
        await using var context = await _contextFactory.CreateDbContextAsync();
        var unreadCount = await Context.GetUnreadMessageCountAsync(currentStaffId, context);

        // Cache with sliding expiration matching poll interval
        cache.Set(
            cacheKey,
            unreadCount,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60),
                Priority = CacheItemPriority.Normal
            });

        return unreadCount;
    }

    public async Task<List<RecentMessageViewModel>> GetRecentListAsync()
    {
        var staffId = infoService.GetStaffId();
        var currentDate = infoService.GetCurrentTenantTime();

        var allMessages = await Context.TucManualMessages
            .AsNoTracking()
            .AsSplitQuery()
            .ForStaff(staffId)
            .IncludeParticipants()
            .ToListAsync();

        // Group by another party and build a result using helper service
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

    public async Task<List<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId) =>
        await Context.TucManualMessages
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

    public async Task<List<ChatMessageViewModel>> GetMessagesByStaffIdAsync(int otherStaffId, int currentStaffId) =>
        await Context.TucManualMessages
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

    public async Task SendMessageAsync(SendMessageRequest request)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var staffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();

        // Validate that exactly one recipient is specified
        if ((request.SendToStaffId.HasValue ? 1 : 0) + (request.SendToCourierId.HasValue ? 1 : 0) != 1)
            throw new ArgumentException("Must specify exactly one recipient (either SendToStaffId or SendToCourierId)");

        ArgumentException.ThrowIfNullOrEmpty(request.Message);

        var message = new TucManualMessage
        {
            UcmmDate = currentDate,
            UcmmSendFromStaffId = staffId,
            UcmmAttempts = 0,
            UcmmMessage = request.Message
        };

        if (request.SendToCourierId.HasValue)
            await HandleCourierMessageAsync(message, request.SendToCourierId.Value, request.MessageType, isUsTenant,
                currentDate.Date);
        else if (request.SendToStaffId.HasValue) HandleStaffMessage(message, request.SendToStaffId.Value);

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

            HandleStaffMessage(message, staffId);
            messages.Add(message);
        }

        await Context.TucManualMessages.AddRangeAsync(messages);
        await Context.SaveChangesAsync();
    }

    public async Task MarkMessagesAsReadAsync(int otherPartyId, OtherMessagePartyType otherPartyType)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var currentStaffId = infoService.GetStaffId();

        var affectedRows = otherPartyType == OtherMessagePartyType.Courier
            ? await Context.MarkCourierMessagesAsReadAsync(currentStaffId, otherPartyId, currentDate)
            : await Context.MarkStaffMessagesAsReadAsync(currentStaffId, otherPartyId, currentDate);

        if (affectedRows > 0)
        {
            var cacheKey = $"unread-messages:{currentStaffId}";
            cache?.Remove(cacheKey);
        }
    }

    public async Task<List<Suggestion>> GetSavedQuickResponsesAsync()
    {
        var staffId = infoService.GetStaffId();

        var quickResponses = await Context.UserQuickResponses
            .AsNoTracking()
            .Where(r => r.StaffId == staffId && r.IsActive == true)
            .Select(r => new Suggestion
            {
                Id = r.ResponseId,
                Text = r.Message
            })
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

        var rowsAffected = await Context.UserQuickResponses
            .Where(r => r.StaffId == staffId && r.ResponseId == responseId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(r => r.IsActive, false));

        if (rowsAffected == 0)
            throw new ArgumentException($"Quick response with ID {responseId} not found for current staff member.");
    }

    public async Task<List<MessageContactOptionViewModel>> GetNewMessageContactOptionsAsync(string searchTerm)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        var couriers = await Context
            .TucCouriers.Where(c =>
                c.Active == true
                && EF.Functions.Like(c.Code + " " + c.UccrName + " " + c.UccrSurname, $"%{searchTerm}%")
            )
            .OrderBy(c => c.Code)
            .Select(c => new MessageContactOptionViewModel
            {
                Id = Guid.NewGuid(),
                RecordId = c.UccrId,
                Name = c.UccrName + " " + c.UccrSurname,
                OtherMessagePartyType = OtherMessagePartyType.Courier,
                Status = c.CourierLogInOut.LogOutTime != null && c.CourierLogInOut.LogOutTime < currentDate
                    ? "online"
                    : "offline"
            })
            .AsNoTracking()
            .ToListAsync();

        var staff = await Context.TucStaffs
            .Where(s => s.UcstActive == true
                        && EF.Functions.Like(s.UcstFirstName + " " + s.UcstLastName, $"%{searchTerm}%"))
            .OrderBy(s => s.UcstFirstName)
            .Select(s => new MessageContactOptionViewModel
            {
                Id = Guid.NewGuid(),
                RecordId = s.UcstId,
                Name = s.UcstFirstName + " " + s.UcstLastName,
                OtherMessagePartyType = OtherMessagePartyType.Staff,
                Status = "unknown"
            })
            .AsNoTracking()
            .ToListAsync();

        var results = couriers.Concat(staff).ToList();
        return results;
    }

    private async Task HandleCourierMessageAsync(TucManualMessage message, int sendToCourierId, int messageType,
        bool isUsTenant,
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
                throw new ArgumentException($"Courier {courierData.Code} must have a mobile number to send SMS");

            var mobileNumber = !string.IsNullOrWhiteSpace(courierData.PersonalMobile)
                ? courierData.PersonalMobile
                : courierData.UccrMobile;

            message.SendToMobile = NormalizeMobileNumber(mobileNumber, isUsTenant);
            message.Subject = $"SMS to Courier: {courierData.Code}";
        }
    }

    private static void HandleStaffMessage(TucManualMessage message, int sendToStaffId)
    {
        message.UcmmSendToStaffId = sendToStaffId;
        message.Subject = "Staff Message";
    }

    private static TucCourier GetCourierFromMessage(TucManualMessage message, int courierId) =>
        message.UcmmSendFromCourierId == courierId
            ? message.UcmmSendFromCourier
            : message.UcmmSendToCourier;

    private static MessageDeliveryType GetDeliveryMethod(int messageType, bool isLoggedInToday) =>
        messageType switch
        {
            1 => MessageDeliveryType.App,
            2 => MessageDeliveryType.Sms,
            3 => isLoggedInToday ? MessageDeliveryType.App : MessageDeliveryType.Sms,
            _ => throw new ArgumentException($"Invalid message type: {messageType}")
        };

    private static string NormalizeMobileNumber(string phoneNumber, bool isUsTenant)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            return phoneNumber;

        var normalized = phoneNumber.Replace(" ", string.Empty);

        return isUsTenant ? normalized.Replace("+1", string.Empty) : normalized.Replace("+64", "0");
    }
}