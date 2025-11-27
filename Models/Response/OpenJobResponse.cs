using System;

namespace DespatchWeb.Models.Response;

public class OpenJobResponse
{
    public int JobId { get; set; }
    public string Reference { get; set; }
    public string Status { get; set; }
    public DateTimeOffset? PickupTime { get; set; }
    public string PickupName { get; set; }
    public string PickupAddress { get; set; }
    public DateTimeOffset? DeliveryTime { get; set; }
    public string DeliveryName { get; set; }
    public string DeliveryAddress { get; set; }
    public string DriverName { get; set; }
    public int CompletedToday { get; set; }
    public DateTimeOffset? LastCompleted { get; set; }
    public int Quantity { get; set; }
    public string PackageType { get; set; }
    public decimal Mileage { get; set; }
}