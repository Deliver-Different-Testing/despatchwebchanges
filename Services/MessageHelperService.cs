using System;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Services;

public class MessageHelperService : IMessageHelperService
{
    /// <summary>
    /// Gets the other party (not the current staff member) in a message
    /// </summary>
    public MessageParticipant GetOtherParty(TucManualMessage message, int currentStaffId)
    {
        if (message.UcmmSendFromStaffId == currentStaffId)
        {
            // Message is FROM current staff, so other party is the recipient
            if (message.UcmmSendToCourierId.HasValue)
            {
                return new MessageParticipant
                {
                    Id = message.UcmmSendToCourierId.Value,
                    Type = OtherMessagePartyType.Courier,
                    Name = GetParticipantName(courier: message.UcmmSendToCourier),
                    Initials = GetParticipantInitials(courier: message.UcmmSendToCourier),
                    Status = GetCourierStatus(message.UcmmSendToCourier, DateTime.Now)
                };
            }

            if (message.UcmmSendToStaffId.HasValue)
            {
                return new MessageParticipant
                {
                    Id = message.UcmmSendToStaffId.Value,
                    Type = OtherMessagePartyType.Staff,
                    Name = GetParticipantName(staff: message.UcmmSendToStaff),
                    Initials = GetParticipantInitials(staff: message.UcmmSendToStaff),
                    Status = "online" // Assume staff are always online
                };
            }
        }
        else
        {
            // Message is TO current staff, so another party is the sender
            if (message.UcmmSendFromCourierId.HasValue)
            {
                return new MessageParticipant
                {
                    Id = message.UcmmSendFromCourierId.Value,
                    Type = OtherMessagePartyType.Courier,
                    Name = GetParticipantName(courier: message.UcmmSendFromCourier),
                    Initials = GetParticipantInitials(courier: message.UcmmSendFromCourier),
                    Status = GetCourierStatus(message.UcmmSendFromCourier, DateTime.Now)
                };
            }
            else if (message.UcmmSendFromStaffId.HasValue)
            {
                return new MessageParticipant
                {
                    Id = message.UcmmSendFromStaffId.Value,
                    Type = OtherMessagePartyType.Staff,
                    Name = GetParticipantName(staff: message.UcmmSendFromStaff),
                    Initials = GetParticipantInitials(staff: message.UcmmSendFromStaff),
                    Status = "online"
                };
            }
        }

        return new MessageParticipant { Id = 0, Type = OtherMessagePartyType.Staff, Name = "Unknown", Initials = "??" };
    }

    /// <summary>
    /// Gets complete message direction information
    /// </summary>
    public MessageDirection GetMessageDirection(TucManualMessage message, int currentStaffId)
    {
        var isFromCurrent = message.UcmmSendFromStaffId == currentStaffId;
        var isToCurrent = message.UcmmSendToStaffId == currentStaffId;

        return new MessageDirection
        {
            IsFromCurrentUser = isFromCurrent,
            IsToCurrentUser = isToCurrent,
            From = GetSender(message),
            To = GetRecipient(message)
        };
    }

    /// <summary>
    /// Checks if a message is incoming to the specified staff member
    /// </summary>
    public bool IsIncomingMessage(TucManualMessage message, int staffId)
    {
        return message.UcmmSendToStaffId == staffId;
    }

    /// <summary>
    /// Checks if message is outgoing from the specified staff member
    /// </summary>
    public bool IsOutgoingMessage(TucManualMessage message, int staffId)
    {
        return message.UcmmSendFromStaffId == staffId;
    }

    /// <summary>
    /// Gets formatted name for courier or staff
    /// </summary>
    public string GetParticipantName(TucCourier courier = null, TucStaff staff = null)
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
    /// Gets initials for courier or staff
    /// </summary>
    public string GetParticipantInitials(TucCourier courier = null, TucStaff staff = null)
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
    /// Gets courier online/offline status
    /// </summary>
    public string GetCourierStatus(TucCourier courier, DateTime currentDate)
    {
        if (courier?.CourierLogInOut == null)
            return "offline";

        return courier.CourierLogInOut.LogOutTime.HasValue &&
               courier.CourierLogInOut.LogOutTime < currentDate
            ? "online"
            : "offline";
    }

    private MessageParticipant GetSender(TucManualMessage message)
    {
        if (message.UcmmSendFromCourierId.HasValue)
        {
            return new MessageParticipant
            {
                Id = message.UcmmSendFromCourierId.Value,
                Type = OtherMessagePartyType.Courier,
                Name = GetParticipantName(courier: message.UcmmSendFromCourier),
                Initials = GetParticipantInitials(courier: message.UcmmSendFromCourier)
            };
        }

        if (message.UcmmSendFromStaffId.HasValue)
        {
            return new MessageParticipant
            {
                Id = message.UcmmSendFromStaffId.Value,
                Type = OtherMessagePartyType.Staff,
                Name = GetParticipantName(staff: message.UcmmSendFromStaff),
                Initials = GetParticipantInitials(staff: message.UcmmSendFromStaff)
            };
        }

        return new MessageParticipant { Id = 0, Type = OtherMessagePartyType.Staff, Name = "Unknown", Initials = "??" };
    }

    private MessageParticipant GetRecipient(TucManualMessage message)
    {
        if (message.UcmmSendToCourierId.HasValue)
        {
            return new MessageParticipant
            {
                Id = message.UcmmSendToCourierId.Value,
                Type = OtherMessagePartyType.Courier,
                Name = GetParticipantName(courier: message.UcmmSendToCourier),
                Initials = GetParticipantInitials(courier: message.UcmmSendToCourier)
            };
        }

        if (message.UcmmSendToStaffId.HasValue)
        {
            return new MessageParticipant
            {
                Id = message.UcmmSendToStaffId.Value,
                Type = OtherMessagePartyType.Staff,
                Name = GetParticipantName(staff: message.UcmmSendToStaff),
                Initials = GetParticipantInitials(staff: message.UcmmSendToStaff)
            };
        }

        return new MessageParticipant { Id = 0, Type = OtherMessagePartyType.Staff, Name = "Unknown", Initials = "??" };
    }
}