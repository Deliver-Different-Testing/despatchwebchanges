using DespatchWeb.Models;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService : IDisposable
{
    DateTime GetCurrentTenantTime();
    DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone);
    string FormatDateForTenant(DateTime? dateTime);
    int GetStaffId();
    int GetContactId();
    bool IsUsTenant();
    Task<Suggestion> GetStaffInfoAsync();
    string GetTenantTimeZone();
    DateTimeOffset ConvertUtcToTenantTimeZone(DateTime utcDateTime);
}
