using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Dto;

public class OpenJobDto
{
    public int JobId { get; set; }
    public string Reference { get; set; }
    public string StatusName { get; set; }
    public DateTime? PickupTime { get; set; }
    public string PickupFromContact { get; set; }
    public string PickupAddressLine1 { get; set; }
    public string PickupAddressLine2 { get; set; }
    public string PickupAddressLine3 { get; set; }
    public string PickupAddressLine4 { get; set; }
    public string PickupAddressLine5 { get; set; }
    public string PickupAddressLine6 { get; set; }
    public string PickupAddressLine7 { get; set; }
    public string PickupAddressLine8 { get; set; }
    public string PickupTimeZone { get; set; }
    public string DeliverToContact { get; set; }
    public string DeliveryAddressLine1 { get; set; }
    public string DeliveryAddressLine2 { get; set; }
    public string DeliveryAddressLine3 { get; set; }
    public string DeliveryAddressLine4 { get; set; }
    public string DeliveryAddressLine5 { get; set; }
    public string DeliveryAddressLine6 { get; set; }
    public string DeliveryAddressLine7 { get; set; }
    public string DeliveryAddressLine8 { get; set; }
    public string DeliveryTimeZone { get; set; }
    public string CourierName { get; set; }
    public string CourierSurname { get; set; }
    public int Quantity { get; set; }
    public string PackageTypeName { get; set; }
    public decimal TotalDistance { get; set; }
    
    public int? CourierId { get; set; }

    // Fields for calculations
    public DateTime? DeliveryTime { get; set; }
    public int? SpeedMinutes { get; set; }
}

public class CourierCompletionData
{
    public int CompletedToday { get; set; }
    public DateTime? LastCompleted { get; set; }
}
