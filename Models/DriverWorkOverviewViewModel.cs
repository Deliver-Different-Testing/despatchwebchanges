namespace DespatchWeb.Models;

public sealed class DriverWorkOverviewViewModel
{
    public int CourierId { get; init; }
    public string Name { get; init; }
    public string VehicleType { get; init; }
    public int JobCount { get; init; }
    public string DriverStatusText { get; init; }
}