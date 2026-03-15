namespace DespatchWeb.Interfaces;

public interface ITenantClock
{
    DateTime TenantNow { get; }
    DateTime TenantToday { get; }
    DateTime UtcNow { get; }
}
