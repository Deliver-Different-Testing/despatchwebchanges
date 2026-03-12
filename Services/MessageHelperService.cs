using System;
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
        var now = clock.TenantNow;
        if (message.UcmmSendFromStaffId == currentStaffId)
        {
            // Message is FROM current staff, so another party is the recipient
            if (message.UcmmSendToCourierId.HasValue)
                return new MessageParticipant
                {
                    Id = message.UcmmSendToCourierId.Value,
                    Type = OtherMessagePartyType.Courier,
                    Name = GetParticipantName(courier: message.UcmmSendToCourier),
                    Initials = GetParticipantInitials(courier: message.UcmmSendToCourier),
                    Status = GetCourierStatus(message.UcmmSendToCourier, now)
                };

            if (message.UcmmSendToStaffId.HasValue)
                return new MessageParticipant
                {
                    Id = message.UcmmSendToStaffId.Value,
                    Type = OtherMessagePartyType.Staff,
                    Name = GetParticipantName(staff: message.UcmmSendToStaff),
                    Initials = GetParticipantInitials(staff: message.UcmmSendToStaff),
                    Status = "online" // Assume staff are always online
                };
        }
        else
        {
            // Message is TO current staff, so another party is the sender
            if (message.UcmmSendFromCourierId.HasValue)
                return new MessageParticipant
                {
                    Id = message.UcmmSendFromCourierId.Value,
                    Type = OtherMessagePartyType.Courier,
                    Name = GetParticipantName(courier: message.UcmmSendFromCourier),
                    Initials = GetParticipantInitials(courier: message.UcmmSendFromCourier),
                    Status = GetCourierStatus(message.UcmmSendFromCourier, now)
                };

            if (message.UcmmSendFromStaffId.HasValue)
                return new MessageParticipant
                {
                    Id = message.UcmmSendFromStaffId.Value,
                    Type = OtherMessagePartyType.Staff,
                    Name = GetParticipantName(staff: message.UcmmSendFromStaff),
                    Initials = GetParticipantInitials(staff: message.UcmmSendFromStaff),
                    Status = "online"
                };
        }

        return new MessageParticipant { Id = 0, Type = OtherMessagePartyType.Staff, Name = "Unknown", Initials = "??" };
    }

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
            return !string.IsNullOrEmpty(courier.UccrName) && !string.IsNullOrEmpty(courier.UccrSurname)
                ? $"{courier.UccrName} {courier.UccrSurname}"
                : "Unknown Courier";

        if (staff != null)
            return !string.IsNullOrEmpty(staff.UcstFirstName) && !string.IsNullOrEmpty(staff.UcstLastName)
                ? $"{staff.UcstFirstName} {staff.UcstLastName}"
                : "Unknown Staff";

        return "Unknown";
    }

    /// <summary>
    /// Gets the initials of a participant (courier or staff member).
    /// </summary>
    private static string GetParticipantInitials(TucCourier courier = null, TucStaff staff = null)
    {
        if (courier != null)
            return !string.IsNullOrEmpty(courier.UccrName) && !string.IsNullOrEmpty(courier.UccrSurname)
                ? $"{courier.UccrName[0]}{courier.UccrSurname[0]}"
                : "??";

        if (staff != null)
            return !string.IsNullOrEmpty(staff.UcstFirstName) && !string.IsNullOrEmpty(staff.UcstLastName)
                ? $"{staff.UcstFirstName[0]}{staff.UcstLastName[0]}"
                : "??";

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
            return "offline";

        return courier.CourierLogInOut.LogOutTime.HasValue &&
               courier.CourierLogInOut.LogOutTime < currentDate
            ? "online"
            : "offline";
    }
}