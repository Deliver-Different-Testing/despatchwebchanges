namespace DespatchWeb.Models;

public sealed class AssignedFlight
{
    public string FlightNumber { get; set; }
    public DateTimeOffset? ExpectedDeparture { get; set; }
    public string DepartureTimeZone { get; set; }
    public DateTimeOffset? ExpectedArrival { get; set; }
    public string ArrivalTimeZone { get; set; }
    public string Notes { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = new();
}
