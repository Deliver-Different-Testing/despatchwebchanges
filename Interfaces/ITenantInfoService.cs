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
    /// 5=DFRNTAdmin, 6=ConnectedTenant. Null when the claim is absent
    /// (couriers / pre-claim sessions). Use this for the canonical NP check
    /// rather than inferring from NpAgentId.
    /// </summary>
    int? GetClientTypeId();

    /// <summary>
    /// tucClient.NpAgentId for the logged-in user, stamped on the JWT at
    /// Hub login. Lets NP-scoped surfaces apply a WHERE NpAgentId = &lt;claim&gt;
    /// filter without a per-request tucClient lookup. Null when the user
    /// has no NP scope.
    /// </summary>
    int? GetNpAgentId();
    Task<Suggestion> GetStaffInfoAsync();
    string GetTenantTimeZone();
    DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime);
}