using System;

namespace DespatchWeb.Models.Dto;

public class CargoFacilityDto
{
    public DateTime? DeliverByTime { get; set; }
    public int ProcessingTime { get; set; }
    public DateTime CargoOpeningTime { get; set; }
    public DateTime CargoClosingTime { get; set; }
}