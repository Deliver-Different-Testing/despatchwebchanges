using System;

namespace DespatchWeb.Models.Response;

public class FlightCargoProcessingModel
{
    public DateTime ArrivalTime { get; set; }
    public int ProcessingTimeMins { get; set; }
    public DateTime CargoOpeningTime { get; set; }
    public DateTime CargoClosingTime { get; set; }
    public DateTime? DeliverByTime { get; set; }
}