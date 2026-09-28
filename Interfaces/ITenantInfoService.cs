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
    /// <summary>
    /// Current tenant ID from the <c>CurrentTenantID</c> claim, as a string. Used to
    /// determine the local side of an inter-tenant pairing (matches against
    /// <see cref="EntityClasses.IntMgrPartnerPairing.OwnerTenantId"/> /
    /// <see cref="EntityClasses.IntMgrPartnerPairing.PartnerTenantId"/>, which are
    /// stored as strings). Returns null when no claim is present (background jobs,
    /// service-account paths).
    /// </summary>
    string? GetCurrentTenantId();
    int GetContactId();
    bool IsUsTenant();
    Task<Suggestion> GetStaffInfoAsync();
    string GetTenantTimeZone();
    DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime);
}
