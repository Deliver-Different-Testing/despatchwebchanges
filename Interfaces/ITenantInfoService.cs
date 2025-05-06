using System;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService
{
    DateTime GetCurrentTenantTime();
    DateTime ConvertUtcToTenantTime(DateTime utcDateTime);
    int GetStaffId();
    bool IsUsTenant();
}
