#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// One eligible driver's minimum-hourly-top-up standing for the current pay period. Deliberately carries no hourly
/// rate, minimum hours or owed amount: dispatchers only ever see how far behind a driver is (and, when the tenant
/// allows it, hours).
/// </summary>
public sealed class DriverTopUpStatus
{
    public int CourierId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int DaysWorked { get; set; }
    public int Deliveries { get; set; }
    public decimal PaidHours { get; set; }
    /// <summary>Owed minus earned for the period so far (through yesterday); never negative.</summary>
    public decimal BehindBy { get; set; }
    /// <summary>Tenant-local end of today's minimum paid block; null when the alert is off or no job has started today.</summary>
    public DateTime? MinimumEndsAt { get; set; }
    public int? MinimumAlertMinutes { get; set; }
    public bool ShowHours { get; set; }
}

public interface IDriverTopUpStatusService
{
    /// <summary>
    /// The eligible drivers' standing, or an empty list when the caller lacks <c>dw-driver-earnings-status</c> or the
    /// feature is not set up. Never throws: a failure here must not break the dispatch board.
    /// </summary>
    Task<IReadOnlyList<DriverTopUpStatus>> GetStatusesAsync();
}
