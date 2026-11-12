#nullable enable
using System.Globalization;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

/// <summary>The dispatch views an agent may read: only those the signed-in user can use, which is also the default set.</summary>
public static class AgentViewScope
{
    public static async Task<(IReadOnlyList<int> Ids, IReadOnlyList<DfrntPageViewModel> Allowed, bool Resolved)> ResolveAsync(
        IDfrntViewsRepository views, ITenantInfoService tenant, IReadOnlyList<int>? requested)
    {
        var allowed = (await views.GetViewsByUserAndPageAsync(tenant.GetStaffId(), AppPage.Dispatch)).ToList();
        var given = (requested ?? []).Distinct().ToList();
        if (given.Count == 0) return ([.. allowed.Select(v => v.Id)], allowed, true);

        var foreign = given.Except(allowed.Select(v => v.Id)).ToList();
        if (foreign.Count > 0)
        {
            throw new AgentReadException(
                $"despatch_view_ids {string.Join(", ", foreign.Select(i => i.ToString(CultureInfo.InvariantCulture)))} are not dispatch views this login can use. Omit despatch_view_ids to use this login's own views.");
        }

        return (given, allowed, false);
    }
}
