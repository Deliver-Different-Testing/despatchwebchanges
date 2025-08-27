using System;

namespace DespatchWeb.Models.Response;

public class OpenJobResponse
{
    public int JobId { get; set; }
    public string Reference { get; set; }
    public string Status { get; set; }
    public DateTime PickupTime { get; set; }
    public string PickupName { get; set; }
    public string PickupAddress { get; set; }
    public DateTime DeliveryTime { get; set; }
    public string DeliveryName { get; set; }
    public string DeliveryAddress { get; set; }
    public string DriverName { get; set; }
    public int CompletedToday { get; set; }
    public DateTime? LastCompleted { get; set; }
    public short Quantity { get; set; }
    public string PackageType { get; set; }
    public decimal Mileage { get; set; }
}