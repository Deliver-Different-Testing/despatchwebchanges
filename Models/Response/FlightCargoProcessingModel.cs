using System;

namespace DespatchWeb.Models.Response;

public class FlightCargoProcessingModel
{
    public DateTime ArrivalTime { get; set; }
    public int ProcessingTimeMins { get; set; }
    public DateTimeOffset CargoOpeningTime { get; set; }
    public DateTimeOffset CargoClosingTime { get; set; }
    public DateTime? DeliverByTime { get; set; }
}