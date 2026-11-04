using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Services;

/// <summary>
/// Service for processing messaging data and determining message participants.
/// </summary>
public sealed class MessageHelperService(ITenantClock clock) : IMessageHelperService
{
    /// <summary>
    /// Determines the other party in a message conversation based on the current staff member.
    /// Identifies whether the other party is a courier or staff member and returns their details.
    /// </summary>
    /// <param name="message">The message to analyze.</param>
    /// <param name="currentStaffId">The ID of the current staff member viewing the message.</param>
    /// <returns>A MessageParticipant object containing the other party's details.</returns>
    public MessageParticipant GetOtherParty(TucManualMessage message, int currentStaffId)
    {
        if (message.UcmmSendFromStaffId == currentStaffId)
        {
            // Message is FROM current staff, so another party is the recipient
            if (message.UcmmSendToCourierId.HasValue)
                return DescribeCourier(message.UcmmSendToCourierId.Value, message.UcmmSendToCourier);

            if (message.UcmmSendToStaffId.HasValue)
                return DescribeStaff(message.UcmmSendToStaffId.Value, message.UcmmSendToStaff);
        }
        else
        {
            // Message is TO current staff, so another party is the sender
            if (message.UcmmSendFromCourierId.HasValue)
                return DescribeCourier(message.UcmmSendFromCourierId.Value, message.UcmmSendFromCourier);

            if (message.UcmmSendFromStaffId.HasValue)
                return DescribeStaff(message.UcmmSendFromStaffId.Value, message.UcmmSendFromStaff);
        }

        return new MessageParticipant { Id = 0, Type = OtherMessagePartyType.Staff, Name = "Unknown", Initials = "??" };
    }

    public MessageParticipant DescribeCourier(int courierId, TucCourier courier) => new()
    {
        Id = courierId,
        Type = OtherMessagePartyType.Courier,
        Name = GetParticipantName(courier: courier),
        Initials = GetParticipantInitials(courier: courier),
        Status = GetCourierStatus(courier, clock.TenantNow)
    };

    public MessageParticipant DescribeStaff(int staffId, TucStaff staff) => new()
    {
        Id = staffId,
        Type = OtherMessagePartyType.Staff,
        Name = GetParticipantName(staff: staff),
        Initials = GetParticipantInitials(staff: staff),
        Status = "online" // Assume staff are always online
    };

    /// <summary>
    /// Determines if a message is incoming (sent to the specified staff member).
    /// </summary>
    public bool IsIncomingMessage(TucManualMessage message, int staffId) => message.UcmmSendToStaffId == staffId;

    /// <summary>
    /// Gets the full name of a participant (courier or staff member).
    /// </summary>
    private static string GetParticipantName(TucCourier courier = null, TucStaff staff = null)
    {
        if (courier != null)
        {
            return !string.IsNullOrEmpty(courier.UccrName) && !string.IsNullOrEmpty(courier.UccrSurname)
                ? $"{courier.UccrName} {courier.UccrSurname}"
                : "Unknown Courier";
        }

        if (staff != null)
        {
            return !string.IsNullOrEmpty(staff.UcstFirstName) && !string.IsNullOrEmpty(staff.UcstLastName)
                ? $"{staff.UcstFirstName} {staff.UcstLastName}"
                : "Unknown Staff";
        }

        return "Unknown";
    }

    /// <summary>
    /// Gets the initials of a participant (courier or staff member).
    /// </summary>
    private static string GetParticipantInitials(TucCourier courier = null, TucStaff staff = null)
    {
        if (courier != null)
        {
            return !string.IsNullOrEmpty(courier.UccrName) && !string.IsNullOrEmpty(courier.UccrSurname)
                ? $"{courier.UccrName[0]}{courier.UccrSurname[0]}"
                : "??";
        }

        if (staff != null)
        {
            return !string.IsNullOrEmpty(staff.UcstFirstName) && !string.IsNullOrEmpty(staff.UcstLastName)
                ? $"{staff.UcstFirstName[0]}{staff.UcstLastName[0]}"
                : "??";
        }

        return "??";
    }
    
    /// <summary>
    /// Determines the online/offline status of a courier based on their login state.
    /// </summary>
    /// <param name="courier">The courier to check.</param>
    /// <param name="currentDate">The current date/time for comparison.</param>
    /// <returns>"online" if the courier is logged in and not logged out, otherwise "offline".</returns>
    public string GetCourierStatus(TucCourier courier, DateTime currentDate)
    {
        if (courier?.CourierLogInOut == null)
        {
            return "offline";
        }

        return courier.CourierLogInOut.LogOutTime.HasValue &&
               courier.CourierLogInOut.LogOutTime < currentDate
            ? "online"
            : "offline";
    }
}