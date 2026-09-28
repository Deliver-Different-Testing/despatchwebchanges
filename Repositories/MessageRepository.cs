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
    ITenantClock clock,
    IMessageHelperService messageHelper,
    IMemoryCache cache) : BaseRepository(contextFactory), IMessageRepository
{
    private const int RecentMessageDays = 90;
    private readonly IDbContextFactory<DespatchContext> _contextFactory = contextFactory;

    public async Task<int> GetUnreadMessageCountAsync()
    {
        var currentStaffId = infoService.GetStaffId();
        var cacheKey = $"unread-messages:{currentStaffId}";

        // Try cache first
        if (cache.TryGetValue<int>(cacheKey, out var cachedCount))
        {
            return cachedCount;
        }

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

    public async Task<IReadOnlyList<RecentMessageViewModel>> GetRecentListAsync()
    {
        var staffId = infoService.GetStaffId();
        var currentDate = clock.TenantNow;
        var cutoffDate = currentDate.AddDays(-RecentMessageDays);

        var allMessages = await Context.TucManualMessages
            .Where(m => m.UcmmDate >= cutoffDate)
            .ForStaff(staffId)
            .IncludeParticipants()
            .OrderByDescending(m => m.UcmmDate)
            .Take(1000)
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

    public async Task<IReadOnlyList<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId,
        int limit = 200) =>
        await Context.TucManualMessages
            .BetweenStaffAndCourier(staffId, courierId)
            .OrderByDescending(m => m.UcmmDate)
            .Take(limit)
            .OrderBy(m => m.UcmmDate)
            .ThenBy(m => m.UcmmId)
            .Select(m => new ChatMessageViewModel
            {
                MessageId = m.UcmmId,
                SendFromStaffId = m.UcmmSendFromStaffId,
                SendToStaffId = m.UcmmSendToStaffId,
                SendFromCourierId = m.UcmmSendFromCourierId,
                SendToCourierId = m.UcmmSendToCourierId,
                Message = m.UcmmMessage,
                MessageTime = m.UcmmDate,
                Read = m.Read,
                ReadTime = m.TimeRead,
                Sent = m.UcmmSent,
                IsSender = m.UcmmSendFromStaffId == staffId
            })
            .ToListAsync();

    public async Task<IReadOnlyList<ChatMessageViewModel>> GetMessagesByStaffIdAsync(int otherStaffId,
        int currentStaffId, int limit = 200) =>
        await Context.TucManualMessages
            .BetweenStaff(currentStaffId, otherStaffId)
            .OrderByDescending(m => m.UcmmDate)
            .Take(limit)
            .OrderBy(m => m.UcmmDate)
            .ThenBy(m => m.UcmmId)
            .Select(m => new ChatMessageViewModel
            {
                MessageId = m.UcmmId,
                SendFromStaffId = m.UcmmSendFromStaffId,
                SendToStaffId = m.UcmmSendToStaffId,
                SendFromCourierId = m.UcmmSendFromCourierId,
                SendToCourierId = m.UcmmSendToCourierId,
                Message = m.UcmmMessage,
                MessageTime = m.UcmmDate,
                Read = m.Read,
                ReadTime = m.TimeRead,
                Sent = m.UcmmSent,
                IsSender = m.UcmmSendFromStaffId == currentStaffId
            })
            .ToListAsync();

    public async Task SendMessageAsync(SendMessageRequest request)
    {
        var currentDate = clock.TenantNow;
        var staffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();

        // Validate that exactly one recipient is specified
        if ((request.SendToStaffId.HasValue ? 1 : 0) + (request.SendToCourierId.HasValue ? 1 : 0) != 1)
        {
            throw new ArgumentException("Must specify exactly one recipient (either SendToStaffId or SendToCourierId)",
                nameof(request));
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
            await HandleCourierMessageAsync(message, request.SendToCourierId.Value, request.MessageType, isUsTenant,
                currentDate.Date);
        }
        else if (request.SendToStaffId.HasValue)
        {
            HandleStaffMessage(message, request.SendToStaffId.Value);
        }

        await Context.TucManualMessages.AddAsync(message);
        await Context.SaveChangesAsync();
    }

    public async Task SendMultipleMessagesAsync(SendMultipleMessageRequest request)
    {
        var currentDate = clock.TenantNow;
        var currentStaffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();
        List<TucManualMessage> messages = [];

        // Batch-load courier data for all recipients in a single query (avoids N+1)
        if (request.SendToCourierIds.Count > 0)
        {
            var courierDataMap = await (from courier in Context.TucCouriers
                where request.SendToCourierIds.Contains(courier.UccrId) && courier.Active
                join loginOut in Context.TblCourierLogInOuts
                    on courier.CourierLogInOutId equals loginOut.CourierLogInOutId into loginGroup
                from login in loginGroup.DefaultIfEmpty()
                select new CourierDataDto
                {
                    CourierId = courier.UccrId,
                    Code = courier.Code,
                    PersonalMobile = courier.PersonalMobile,
                    UccrMobile = courier.UccrMobile,
                    IsLoggedInToday = login != null &&
                                      login.LogInTime.Date == currentDate.Date &&
                                      !login.LogOutTime.HasValue
                }).ToDictionaryAsync(c => c.CourierId);

            foreach (var courierId in request.SendToCourierIds)
            {
                if (!courierDataMap.TryGetValue(courierId, out var courierData))
                {
                    throw new ArgumentException($"Courier {courierId} not found or inactive", nameof(request));
                }

                var message = new TucManualMessage
                {
                    UcmmDate = currentDate,
                    UcmmSendFromStaffId = currentStaffId,
                    UcmmAttempts = 0,
                    UcmmMessage = request.Message,
                    UcmmSendToCourierId = courierId,
                    UcmmSendTo = courierId
                };

                var deliveryMethod = GetDeliveryMethod(request.MessageType, courierData.IsLoggedInToday);

                // Always set SendToMobile so SMPP_qryManualMessages can find the message
                var mobileNumber = !string.IsNullOrWhiteSpace(courierData.PersonalMobile)
                    ? courierData.PersonalMobile
                    : courierData.UccrMobile;

                if (!string.IsNullOrWhiteSpace(mobileNumber))
                {
                    message.SendToMobile = NormalizeMobileNumber(mobileNumber, isUsTenant);
                }

                if (deliveryMethod == MessageDeliveryType.App)
                {
                    message.Subject = "Courier Manager";
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(message.SendToMobile))
                    {
                        throw new ArgumentException($"Courier {courierData.Code} must have a mobile number to send SMS",
                            nameof(request));
                    }

                    message.Subject = $"SMS to Courier: {courierData.Code}";
                }

                messages.Add(message);
            }
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
        var currentDate = clock.TenantNow;
        var currentStaffId = infoService.GetStaffId();

        var affectedRows = otherPartyType == OtherMessagePartyType.Courier
            ? await MarkCourierMessagesAsReadAsync(currentStaffId, otherPartyId, currentDate)
            : await MarkStaffMessagesAsReadAsync(currentStaffId, otherPartyId, currentDate);

        if (affectedRows > 0)
        {
            var cacheKey = $"unread-messages:{currentStaffId}";
            cache?.Remove(cacheKey);
        }
    }

    public async Task<IReadOnlyList<Suggestion>> GetSavedQuickResponsesAsync()
    {
        var staffId = infoService.GetStaffId();

        var quickResponses = await Context.UserQuickResponses
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
        {
            throw new ArgumentException($"Quick response with ID {responseId} not found for current staff member.",
                nameof(responseId));
        }
    }

    public async Task<IReadOnlyList<MessageContactOptionViewModel>> GetNewMessageContactOptionsAsync(string searchTerm)
    {
        var currentDate = clock.TenantNow;

        var couriers = await Context
            .TucCouriers.Where(c =>
                c.Active == true
                && EF.Functions.Like(c.Code + " " + c.UccrName + " " + c.UccrSurname, $"%{searchTerm}%")
            )
            .OrderBy(c => c.Code)
            .Take(50)
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
            .ToListAsync();

        var staff = await Context.TucStaffs
            .Where(s => s.UcstActive == true
                        && EF.Functions.Like(s.UcstFirstName + " " + s.UcstLastName, $"%{searchTerm}%"))
            .OrderBy(s => s.UcstFirstName)
            .Take(50)
            .Select(s => new MessageContactOptionViewModel
            {
                Id = Guid.NewGuid(),
                RecordId = s.UcstId,
                Name = s.UcstFirstName + " " + s.UcstLastName,
                OtherMessagePartyType = OtherMessagePartyType.Staff,
                Status = "unknown"
            })
            .ToListAsync();

        var results = couriers.Concat(staff).ToList();
        return results;
    }

    private async Task<int> MarkCourierMessagesAsReadAsync(int staffId, int fromCourierId, DateTime readTime) =>
        await Context.TucManualMessages
            .Where(m => m.UcmmSendToStaffId == staffId &&
                        !m.Read &&
                        m.UcmmSendFromCourierId == fromCourierId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.Read, true)
                .SetProperty(m => m.TimeRead, readTime));

    private async Task<int> MarkStaffMessagesAsReadAsync(int staffId, int fromStaffId, DateTime readTime) =>
        await Context.TucManualMessages
            .Where(m => m.UcmmSendToStaffId == staffId &&
                        !m.Read &&
                        m.UcmmSendFromStaffId == fromStaffId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.Read, true)
                .SetProperty(m => m.TimeRead, readTime));

    private async Task HandleCourierMessageAsync(TucManualMessage message, int sendToCourierId, int messageType,
        bool isUsTenant,
        DateTime currentDate)
    {
        var courierData = await Context.TucCouriers
            .Where(c => c.UccrId == sendToCourierId && c.Active == true)
            .Select(c => new CourierDataDto
            {
                CourierId = c.UccrId,
                Code = c.Code,
                PersonalMobile = c.PersonalMobile,
                UccrMobile = c.UccrMobile,
                IsLoggedInToday = c.CourierLogInOut != null &&
                                  c.CourierLogInOut.LogInTime.Date == currentDate &&
                                  !c.CourierLogInOut.LogOutTime.HasValue
            }).FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(courierData);

        var deliveryMethod = GetDeliveryMethod(messageType, courierData.IsLoggedInToday);

        message.UcmmSendToCourierId = sendToCourierId;
        message.UcmmSendTo = sendToCourierId;

        // Always set SendToMobile so SMPP_qryManualMessages can find the message
        // even if the tucCourier JOIN fails (e.g. uccrMobile is NULL)
        var mobileNumber = !string.IsNullOrWhiteSpace(courierData.PersonalMobile)
            ? courierData.PersonalMobile
            : courierData.UccrMobile;

        if (!string.IsNullOrWhiteSpace(mobileNumber))
        {
            message.SendToMobile = NormalizeMobileNumber(mobileNumber, isUsTenant);
        }

        if (deliveryMethod == MessageDeliveryType.App)
        {
            message.Subject = "Courier Manager";
        }
        else // SMS
        {
            if (string.IsNullOrWhiteSpace(message.SendToMobile))
            {
                throw new ArgumentException($"Courier {courierData.Code} must have a mobile number to send SMS",
                    nameof(sendToCourierId));
            }

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
            _ => throw new ArgumentException($"Invalid message type: {messageType}", nameof(messageType))
        };

    private static string NormalizeMobileNumber(string phoneNumber, bool isUsTenant)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return phoneNumber;
        }

        var normalized = phoneNumber.Replace(" ", string.Empty);

        return isUsTenant ? normalized.Replace("+1", string.Empty) : normalized.Replace("+64", "0");
    }

    private class CourierDataDto
    {
        public int CourierId { get; init; }
        public string Code { get; init; }
        public string PersonalMobile { get; init; }
        public string UccrMobile { get; init; }
        public bool IsLoggedInToday { get; init; }
    }
}