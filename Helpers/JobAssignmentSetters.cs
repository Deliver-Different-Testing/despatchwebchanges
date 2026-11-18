using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.Helpers;

public static class JobAssignmentSetters
{
    /// <summary>The dispatch stamps a dispatcher's allocation and the voice agent's claim both write.</summary>
    public static UpdateSettersBuilder<TucJob> AssignToCourier(this UpdateSettersBuilder<TucJob> setters,
        int courierId, int? dispatcherStaffId, DateTime dispatchedAt) =>
        setters
            .SetProperty(j => j.UcjbCourierId, courierId)
            .SetProperty(j => j.AgentId, (int?)null)
            .SetProperty(j => j.UcjbDispId, dispatcherStaffId)
            .SetProperty(j => j.DesCheck, false)
            .SetProperty(j => j.FdcourierId, (int?)null)
            .SetProperty(j => j.UcjbDispDate, dispatchedAt)
            .SetProperty(j => j.UcjbDispTime, dispatchedAt)
            .SetProperty(j => j.UcjbStatus, (int)JobStatus.Dispatched)
            .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.AwaitingPod);

    /// <summary>
    /// Un-assigns the agent and, unless <paramref name="keepNetworkPartner"/>, the network partner.
    /// Every path that returns a job to unassigned uses this, so a stale assignee can't outlive a
    /// restore. A network partner restoring its own job keeps it: clearing NpAgentId would hide the
    /// job from them and drop their pay.
    /// </summary>
    public static UpdateSettersBuilder<TucJob> ClearAgentAssignments(this UpdateSettersBuilder<TucJob> setters,
        bool keepNetworkPartner)
    {
        setters.SetProperty(j => j.AgentId, (int?)null);
        if (!keepNetworkPartner)
        {
            setters.SetProperty(j => j.NpAgentId, (int?)null);
        }

        return setters;
    }
}
