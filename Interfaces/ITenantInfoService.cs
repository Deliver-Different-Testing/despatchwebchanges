#nullable enable
using DespatchWeb.Models;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService : IDisposable
{
    DateTime GetCurrentTenantTime();
    DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone);
    string FormatDateForTenant(DateTime? dateTime);
    int GetStaffId();
    string? GetCurrentTenantId();
    int GetContactId();
    bool IsUsTenant();

    /// <summary>
    /// tucClient.ClientTypeId for the logged-in user, stamped on the JWT at
    /// Hub login (Phase 5+ data-scope). 1=Internal, 2=Customer, 3=NetworkPartner,
    /// 4=Tenant, 5=DFRNTAdmin, 6=ConnectedTenant. Null when the claim is absent
    /// (couriers / pre-claim sessions). Use this for the canonical NP check
    /// rather than inferring from NpAgentId.
    /// </summary>
    int? GetClientTypeId();

    /// <summary>
    /// True when the <c>ClientTypeId</c> claim is missing from the cookie
    /// entirely (pre-2026-06-03 Hub sessions). Distinguishes "claim absent →
    /// fall back to DB lookup" from "claim present but empty/unparseable".
    /// </summary>
    bool ClientTypeIdClaimAbsent { get; }

    /// <summary>
    /// tucClient.NpAgentId for the logged-in user, stamped on the JWT at
    /// Hub login. Lets NP-scoped surfaces apply a WHERE NpAgentId = &lt;claim&gt;
    /// filter without a per-request tucClient lookup. Null when the user
    /// has no NP scope.
    /// </summary>
    int? GetNpAgentId();

    /// <summary>
    /// True when the <c>NpAgentId</c> claim is missing entirely (pre-2026-06-03
    /// Hub sessions). Empty-string claim is <see cref="NpAgentIdClaimEmpty"/>.
    /// </summary>
    bool NpAgentIdClaimAbsent { get; }

    /// <summary>
    /// True when the <c>NpAgentId</c> claim is present but empty —
    /// Hub-authoritative "no NP linkage". Filters must deny without a DB
    /// fallback in this case.
    /// </summary>
    bool NpAgentIdClaimEmpty { get; }

    /// <summary>
    /// tucClient.UcclId for the logged-in user, stamped as the <c>ClientID</c>
    /// PascalCase claim by Hub. Used by the Customer/Internal data-scope
    /// predicate (WHERE UcjbClientId = &lt;claim&gt;) and as the lookup key
    /// for the transitional DB fallback when newer claims are absent.
    /// </summary>
    int? GetClientId();

    Task<Suggestion> GetStaffInfoAsync();
    string GetTenantTimeZone();
    DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime);
}
