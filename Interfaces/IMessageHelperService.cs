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
    /// Builds a courier participant; a null courier (missing or filtered row) yields "Unknown"
    /// </summary>
    MessageParticipant DescribeCourier(int courierId, TucCourier courier);

    /// <summary>
    /// Builds a staff participant; a null staff row yields "Unknown"
    /// </summary>
    MessageParticipant DescribeStaff(int staffId, TucStaff staff);

    /// <summary>
    /// Checks if message is incoming to the specified staff member
    /// </summary>
    bool IsIncomingMessage(TucManualMessage message, int staffId);

    /// <summary>
    /// Gets courier online/offline status
    /// </summary>
    string GetCourierStatus(TucCourier courier, DateTime currentDate);
}