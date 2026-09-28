using DespatchWeb.Interfaces;

namespace DespatchWeb.Tests.Helpers;

public class FakeTenantClock(DateTime fixedTime) : ITenantClock
{
    public DateTime TenantNow => fixedTime;
    public DateTime TenantToday => fixedTime.Date;
    public DateTime UtcNow => fixedTime.ToUniversalTime();
}
