using System;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService
{
    DateTime GetCurrentTenantTime();
    DateTime ConvertUtcToTenantTime(DateTime utcDateTime);
    DateTime ConvertUtcToTenantTime(string utcDateTime);
    string FormatDateForTenant(DateTime? dateTime);
    int GetStaffId();
    bool IsUsTenant();
}
