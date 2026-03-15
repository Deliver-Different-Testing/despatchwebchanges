namespace DespatchWeb.Models;

public class AssignFlightToJobRequest
{
    public int JobId { get; init; }
    public int? FromAirportId { get; init; }
    public int? ToAirportId { get; init; }
    public string FlightNumber { get; init; }
    public DateTimeOffset DepartureDate { get; init; }
    public List<FlightSegmentViewModel> FlightSegments { get; init; } = [];
    public DateTimeOffset? PackageReadyTime { get; init; }
    public DateTimeOffset? PackageDeliverByTime { get; init; }
    public string PackageDeliveryNotes { get; init; }
}