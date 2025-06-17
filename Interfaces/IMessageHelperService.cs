using System;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IMessageHelperService
{
    /// <summary>
    /// Gets the other party (not the current staff member) in a message
    /// </summary>
    MessageParticipant GetOtherParty(TucManualMessage message, int currentStaffId);

    /// <summary>
    /// Gets complete message direction information
    /// </summary>
    MessageDirection GetMessageDirection(TucManualMessage message, int currentStaffId);

    /// <summary>
    /// Checks if message is incoming to the specified staff member
    /// </summary>
    bool IsIncomingMessage(TucManualMessage message, int staffId);

    /// <summary>
    /// Checks if message is outgoing from the specified staff member
    /// </summary>
    bool IsOutgoingMessage(TucManualMessage message, int staffId);

    /// <summary>
    /// Gets formatted name for courier or staff
    /// </summary>
    string GetParticipantName(TucCourier courier = null, TucStaff staff = null);

    /// <summary>
    /// Gets initials for courier or staff
    /// </summary>
    string GetParticipantInitials(TucCourier courier = null, TucStaff staff = null);

    /// <summary>
    /// Gets courier online/offline status
    /// </summary>
    string GetCourierStatus(TucCourier courier, DateTime currentDate);
}