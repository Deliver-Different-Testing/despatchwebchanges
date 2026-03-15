namespace DespatchWeb.Models.Response;

public class FlightCargoProcessingModel
{
    public DateTime ArrivalTime { get; init; }
    public int ProcessingTimeMins { get; init; }
    public DateTimeOffset CargoOpeningTime { get; init; }
    public DateTimeOffset CargoClosingTime { get; init; }
    public DateTime? DeliverByTime { get; init; }
}