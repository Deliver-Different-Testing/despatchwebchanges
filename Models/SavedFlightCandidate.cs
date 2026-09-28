namespace DespatchWeb.Models;

// A materialised live job that came from a recurring booking carrying a
// SavedFlightNumber — the input to best-effort flight auto-assignment on
// push-to-live. Airports + departure date come from the job/template so the
// service can re-run the route search and match the saved flight number.
public sealed class SavedFlightCandidate
{
    public int JobId { get; init; }
    public int? FromAirportId { get; init; }
    public int? ToAirportId { get; init; }
    public string SavedFlightNumber { get; init; }
    public DateTimeOffset DepartureDate { get; init; }
}
