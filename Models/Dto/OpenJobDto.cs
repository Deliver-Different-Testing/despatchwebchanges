namespace DespatchWeb.Models.Dto;

public sealed record OpenJobDto
{
    public int JobId { get; init; }
    public string Reference { get; init; }
    public string StatusName { get; init; }
    public DateTime? PickupTime { get; init; }
    public string PickupFromContact { get; init; }
    public string PickupAddressLine1 { get; init; }
    public string PickupAddressLine2 { get; init; }
    public string PickupAddressLine3 { get; init; }
    public string PickupAddressLine4 { get; init; }
    public string PickupAddressLine5 { get; init; }
    public string PickupAddressLine6 { get; init; }
    public string PickupAddressLine7 { get; init; }
    public string PickupAddressLine8 { get; init; }
    public string PickupTimeZone { get; init; }
    public string DeliverToContact { get; init; }
    public string DeliveryAddressLine1 { get; init; }
    public string DeliveryAddressLine2 { get; init; }
    public string DeliveryAddressLine3 { get; init; }
    public string DeliveryAddressLine4 { get; init; }
    public string DeliveryAddressLine5 { get; init; }
    public string DeliveryAddressLine6 { get; init; }
    public string DeliveryAddressLine7 { get; init; }
    public string DeliveryAddressLine8 { get; init; }
    public string DeliveryTimeZone { get; init; }
    public string CourierName { get; init; }
    public string CourierSurname { get; init; }
    public int Quantity { get; init; }
    public string PackageTypeName { get; init; }
    public decimal TotalDistance { get; init; }
    
    public int? CourierId { get; init; }

    // Fields for calculations
    public DateTime? DeliveryTime { get; init; }
    public int? SpeedMinutes { get; init; }
}

public sealed record CourierCompletionData
{
    public int CompletedToday { get; init; }
    public DateTime? LastCompleted { get; init; }
}
