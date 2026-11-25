namespace DespatchWeb.Models;

public sealed class CourierData
{
    public string Courier { get; set; }
    public string CourierNumber { get; set; }
    public string Location { get; set; }
    public string Pu { get; set; }
    public string Del { get; set; }
    public string Lrm { get; set; }
    public string Eta2Lrm { get; set; }
    public int? CourierId { get; set; }
    public string CourierName { get; set; }
    public string CourierMobile { get; set; }

    /// <summary>Dollars behind the minimum hourly guarantee for the pay period so far; null when on target, not eligible or the caller lacks dw-driver-earnings-status.</summary>
    public decimal? EarningsBehindBy { get; set; }

    /// <summary>Tenant-local time today's minimum paid block ends; null unless the alert is on. The client decides when to warn.</summary>
    public DateTime? MinimumEndsAt { get; set; }

    /// <summary>Warning window in minutes (the tenant setting); null = alert off.</summary>
    public int? MinimumAlertMinutes { get; set; }
}
