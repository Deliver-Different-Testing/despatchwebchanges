using System.Security.Claims;
using DeliverDifferent.AgentAccess;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

/// <summary>
/// Hub's app pass carries no UserGroupID, and the export's cost-column rule reads it. This looks the user up by the
/// pass's StaffID (active, internet access, as a cookie login requires) and adds the claim. No StaffID or no row adds
/// nothing, so costs stay out of exports and reads.
/// </summary>
public sealed class AgentUserClaimsEnricher(
    IDbContextFactory<DespatchContext> contextFactory,
    IHttpContextAccessor contextAccessor) : IAgentClaimsEnricher
{
    /// <summary>The exports and the reads decide cost visibility from UserGroupID; other agent requests skip the lookup.</summary>
    public static bool AppliesTo(PathString path) =>
        path.StartsWithSegments("/Agent/Export", StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments("/Agent/Read", StringComparison.OrdinalIgnoreCase);

    public async Task EnrichAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        var http = contextAccessor.HttpContext;
        if (http is null || !AppliesTo(http.Request.Path)) return;
        if (!int.TryParse(principal.FindFirst("StaffID")?.Value, out var staffId)) return;

        // The tenant factory reads CurrentTenantID from HttpContext.User, which the pass has not been assigned to yet.
        http.User = principal;

        await using var context = contextFactory.CreateDbContext();
        var groups = await context.Database
            .SqlQuery<int>($"SELECT TOP 1 UserGroupID AS Value FROM tblUser WHERE StaffID = {staffId} AND Active = 1 AND InternetAccess = 1")
            .ToListAsync(cancellationToken);
        if (groups.Count == 0) return;

        var identity = principal.Identities.FirstOrDefault(i => i.IsAuthenticated) ?? principal.Identity as ClaimsIdentity;
        identity?.AddClaim(new Claim("UserGroupID", groups[0].ToString()));
    }
}



