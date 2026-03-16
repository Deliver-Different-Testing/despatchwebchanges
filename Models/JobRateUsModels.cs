namespace DespatchWeb.Models;

public sealed class JobRateRequest
{
    public int SpeedId { get; set; }
    public decimal? PickupLat { get; set; }
    public decimal? PickupLong { get; set; }
    public decimal? DeliveryLat { get; set; }
    public decimal? DeliveryLong { get; set; }

    /// <summary>
    /// When set, bypasses the GetJobTypeByIdAsync DB lookup in CalculateJobRateUsAsync.
    /// Used by split job re-rating where all children share the same speed.
    /// </summary>
    public bool? IsFlightSpeed { get; set; }
}

public sealed class JobRateResult
{
    public double TotalMiles { get; set; }
    public double FromMiles { get; set; }
    public double ToMiles { get; set; }
    public AddressWithAgent FromAirport { get; set; }
    public AddressWithAgent ToAirport { get; set; }
}