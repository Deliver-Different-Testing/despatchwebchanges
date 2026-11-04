using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore.Query;

namespace DespatchWeb.Helpers;

public static class JobAssignmentSetters
{
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
