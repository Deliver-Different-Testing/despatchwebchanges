namespace DespatchWeb.Models;

public class DriverWorkOverviewViewModel
{
    public int CourierId { get; set; }
    public string Name { get; set; }
    public string VehicleType { get; set; }
    public int JobCount { get; set; }
    public string DriverStatusText { get; set; }
}