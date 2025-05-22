using System;

namespace DespatchWeb.Models.Dto;

public class FlightRateDto
{
    public int JobTypeId { get; set; }
    public string Name { get; set; }
    public string Speed { get; set; }
    public string Description { get; set; }
    public decimal Rate { get; set; }
    public decimal SaleRate { get; set; }
    public string Availability { get; set; }
    public string AvailabilityColour { get; set; }
    public DateTime BookDate { get; set; }
    public int? Duration { get; set; }
    public decimal FlightRate { get; set; }
}
