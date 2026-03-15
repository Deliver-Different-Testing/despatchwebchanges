namespace DespatchWeb.Models.Dto;

public class FlightRateDto
{
    public int JobTypeId { get; init; }
    public string Name { get; init; }
    public string Speed { get; init; }
    public string Description { get; init; }
    public decimal Rate { get; init; }
    public decimal SaleRate { get; init; }
    public string Availability { get; init; }
    public string AvailabilityColour { get; init; }
    public DateTime BookDate { get; init; }
    public int? Duration { get; init; }
    public decimal FlightRate { get; init; }
}
