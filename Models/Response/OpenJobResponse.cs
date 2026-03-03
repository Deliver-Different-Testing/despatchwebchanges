using System;

namespace DespatchWeb.Models.Response;

public class OpenJobResponse
{
    public int JobId { get; init; }
    public string Reference { get; init; }
    public string Status { get; init; }
    public DateTimeOffset? PickupTime { get; init; }
    public string PickupName { get; init; }
    public string PickupAddress { get; init; }
    public DateTimeOffset? DeliveryTime { get; init; }
    public string DeliveryName { get; init; }
    public string DeliveryAddress { get; init; }
    public string DriverName { get; init; }
    public int CompletedToday { get; init; }
    public DateTimeOffset? LastCompleted { get; init; }
    public int Quantity { get; init; }
    public string PackageType { get; init; }
    public decimal Mileage { get; init; }
}