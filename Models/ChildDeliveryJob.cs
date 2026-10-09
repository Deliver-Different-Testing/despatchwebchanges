namespace DespatchWeb.Models;

public class ChildDeliveryJob
{
    public int JobId { get; init; }
    public string JobName { get; init; }
    public string Status { get; init; }
    public int Completion { get; init; }
    public string Pickup { get; init; }
    public string Delivery { get; init; }
    public string Driver { get; init; }
    public string Region { get; init; }
}
