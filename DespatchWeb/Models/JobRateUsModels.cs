namespace DespatchWeb.Models;

public class JobRateRequest
{
    public int SpeedId { get; set; }
    public decimal? PickupLat { get; set; }
    public decimal? PickupLong { get; set; }
    public decimal? DeliveryLat { get; set; }
    public decimal? DeliveryLong { get; set; }
}

public class JobRateResult
{
    public double TotalMiles { get; set; }
    public double FromMiles { get; set; }
    public double ToMiles { get; set; }
    public AddressWithAgent FromAirport { get; set; }
    public AddressWithAgent ToAirport { get; set; }
}