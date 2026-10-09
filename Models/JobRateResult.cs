namespace DespatchWeb.Models;

public sealed class JobRateResult
{
    public double TotalMiles { get; set; }
    public double FromMiles { get; set; }
    public double ToMiles { get; set; }
    public AddressWithAgent FromAirport { get; set; }
    public AddressWithAgent ToAirport { get; set; }
}
