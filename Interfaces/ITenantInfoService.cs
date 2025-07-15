using System;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Interfaces;

public interface ITenantInfoService
{
    DateTime GetCurrentTenantTime();
    DateTime GetCurrentTimeFromTimeZone(TimeZone timeZone);
    string FormatDateForTenant(DateTime? dateTime);
    int GetStaffId();
    bool IsUsTenant();
}
