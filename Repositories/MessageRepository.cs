using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.MessageModels;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class MessageRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : BaseRepository(contextFactory), IMessageRepository
{
    public async Task<List<RecentMessageViewModel>> GetRecentListAsync(int staffId)
    {
        var recentList = await Context.TucManualMessages
            .Where(m => m.UcmmStaffId == staffId)
            .Join(Context.TucCouriers,
                message => message.UcmmSendTo,
                courier => courier.UccrId,
                (message, courier) => new { message, courier })
            .GroupBy(x => x.courier.UccrId)
            .Select(g => new RecentMessageViewModel
            {
                CourierId = g.Key,
                CourierName = $"{g.First().courier.UccrName} {g.First().courier.UccrSurname}",
                Initials =
                    $"{g.First().courier.UccrName.FirstOrDefault()}{g.First().courier.UccrSurname.FirstOrDefault()}",
                Status = "online", // You may want to determine this from another table
                UnreadCount = g.Count(x => !x.message.Read),
                LastMessage = g.OrderByDescending(x => x.message.UcmmDate).First().message.UcmmMessage,
                LastMessageTime = g.OrderByDescending(x => x.message.UcmmDate).First().message.UcmmDate
            })
            .OrderByDescending(x => x.LastMessageTime)
            .AsNoTracking()
            .ToListAsync();

        return recentList;
    }

    public async Task<List<ChatMessageViewModel>> GetMessagesByCourierIdAsync(int courierId, int staffId)
    {
        var messages = await Context.TucManualMessages
            .Where(m => m.UcmmSendTo == courierId && m.UcmmStaffId == staffId)
            .OrderByDescending(m => m.UcmmDate)
            .Select(m => new ChatMessageViewModel
            {
                MessageId = m.UcmmId,
                StaffId = staffId,
                CourierId = courierId,
                Message = m.UcmmMessage,
                MessageTime = m.UcmmTimeSent ?? m.UcmmDate,
                Read = m.Read,
                ReadTime = m.TimeRead,
                Sent = m.UcmmSent
            })
            .ToListAsync();

        return messages;
    }

    public async Task SendMessageToCouriersAsync(SendMessageRequest request)
    {
        var currentDate = infoService.GetCurrentTenantTime();
        var staffId = infoService.GetStaffId();
        var isUsTenant = infoService.IsUsTenant();

        // Single query to get all courier data with login status
        var courierData = await (from courier in Context.TucCouriers
            where request.CourierIds.Contains(courier.UccrId) && courier.Active
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
                                  login.LogInTime.Date == currentDate.ToLocalTime() &&
                                  !login.LogOutTime.HasValue
            }).ToListAsync();

        // Validate all couriers exist and are active
        if (request.CourierIds.Count != courierData.Count)
        {
            var foundIds = courierData.Select(c => c.CourierId).ToList();
            var missingIds = request.CourierIds.Except(foundIds).ToList();
            throw new ArgumentException($"Invalid or inactive courier(s): {string.Join(", ", missingIds)}");
        }

        // Determine delivery method for each courier
        var messageDeliveries = courierData.Select(courier => new
        {
            Courier = courier,
            DeliveryMethod = GetDeliveryMethod(request.MessageType, courier.IsLoggedInToday)
        }).ToList();

        // Validate SMS requirements
        var smsDeliveries = messageDeliveries.Where(md => md.DeliveryMethod == MessageDeliveryType.Sms);
        var couriersWithoutMobile = smsDeliveries
            .Where(md => string.IsNullOrWhiteSpace(md.Courier.PersonalMobile) &&
                         string.IsNullOrWhiteSpace(md.Courier.UccrMobile))
            .Select(md => md.Courier.Code)
            .ToList();

        if (couriersWithoutMobile.Count != 0)
        {
            throw new ArgumentException(
                $"Couriers must have a mobile number to send SMS: {string.Join(", ", couriersWithoutMobile)}");
        }

        // Create message records
        var messagesToAdd = new List<TucManualMessage>();

        foreach (var delivery in messageDeliveries)
        {
            var message = new TucManualMessage
            {
                UcmmDate = currentDate,
                UcmmStaffId = staffId,
                UcmmAttempts = 0,
                UcmmMessage = request.Message
            };

            if (delivery.DeliveryMethod == MessageDeliveryType.App)
            {
                message.UcmmSendTo = delivery.Courier.CourierId;
                message.Subject = "Courier Manager";
            }
            else // SMS
            {
                var mobileNumber = !string.IsNullOrWhiteSpace(delivery.Courier.PersonalMobile)
                    ? delivery.Courier.PersonalMobile
                    : delivery.Courier.UccrMobile;

                message.SendToMobile = NormalizeMobileNumber(mobileNumber, isUsTenant);
                message.Subject = $"SMS to Courier: {delivery.Courier.Code}";
            }

            messagesToAdd.Add(message);
        }

        // Save all messages in one transaction
        if (messagesToAdd.Count != 0)
        {
            Context.TucManualMessages.AddRange(messagesToAdd);
            await Context.SaveChangesAsync();
        }
    }

    private static MessageDeliveryType GetDeliveryMethod(int messageType, bool isLoggedInToday)
    {
        return messageType switch
        {
            1 => MessageDeliveryType.App, // Always internal
            2 => MessageDeliveryType.Sms, // Always SMS
            3 => isLoggedInToday ? MessageDeliveryType.App : MessageDeliveryType.Sms, // Mixed - based on login status
            _ => throw new ArgumentException($"Invalid message type: {messageType}")
        };
    }

    private static string NormalizeMobileNumber(string phoneNumber, bool isUsTenant)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
            return phoneNumber;
    
        var normalized = phoneNumber.Replace(" ", string.Empty);
    
        return isUsTenant ?
            // For US numbers, remove +1 prefix if present
            normalized.Replace("+1", "") :
            // For NZ numbers, replace +64 with 0
            normalized.Replace("+64", "0");
    }
}