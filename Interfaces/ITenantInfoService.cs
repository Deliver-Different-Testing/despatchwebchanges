using System;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService
{
    DateTime GetCurrentTenantTime();
    DateTime ConvertUtcToTenantTime(DateTime utcDateTime);
    DateTime ConvertUtcToTenantTime(string utcDateTime);
    int GetStaffId();
    bool IsUsTenant();
}
