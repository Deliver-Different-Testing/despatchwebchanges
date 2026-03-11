using System;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

public class TenantClock(ITenantInfoService tenantInfoService) : ITenantClock
{
    public DateTime TenantNow => tenantInfoService.GetCurrentTenantTime();
    public DateTime TenantToday => TenantNow.Date;
    public DateTime UtcNow => DateTime.UtcNow;
}
