using System;
using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class CreateMinimalTucJobResponse
{
    public bool Success { get; set; }
    public int? JobId { get; set; }
    public string Message { get; set; }
}

public class CreateMinimalTucJobInputModel
{
    [Required] public string JobNumber { get; set; }

    [Required] public AddressViewModel FromAddress { get; set; }

    [Required] public AddressViewModel ToAddress { get; set; }

    [Required] public string BookedBy { get; set; }

    [Required] public int ClientId { get; set; }

    public int? AgentCourierId { get; set; }
    
    [Required] public int SpeedId { get; set; }

    [Required] public decimal Amount { get; set; }

    public string Reference { get; set; }

    public string ReferenceB { get; set; }

    public string Notes { get; set; }

    [Required] public DateTime TenantCurrentTime { get; set; }

    [Required] public int LoggedInContactId { get; set; }

    public string Speed { get; set; }

    public string ToAddressType { get; set; }

    public int? VehicleSizeId { get; set; }

    public string PickupNotes { get; set; }

    public string DeliveryNotes { get; set; }

    public string FromContactName { get; set; }

    public string FromPhoneNumber { get; set; }

    public string ToContactName { get; set; }

    public string ToPhoneNumber { get; set; }

    public string Type { get; set; }

    public string JobNotificationType { get; set; }

    public string JobNotificationEmail { get; set; }

    public string JobNotificationMobile { get; set; }

    public string ToAddressCode { get; set; }

    public string FromAddressCode { get; set; }

    public bool Hold { get; set; } = false;

    public decimal? AgentAmount { get; set; }

    public decimal? FuelSurchargeAmount { get; set; }

    public string OurRef { get; set; }

    public decimal? PickUpLatitude { get; set; }

    public decimal? PickUpLongitude { get; set; }

    public decimal? DeliveryLatitude { get; set; }

    public decimal? DeliveryLongitude { get; set; }

    public DateTime? Pickup { get; set; }
    
    public bool? PrivateRes { get; set; }

    public DateTime? TruckStartTime { get; set; }


    public int? TotalPallets { get; set; }


    public decimal? DryIceWeight { get; set; }

    public decimal? Cubic { get; set; }
    
    public int? DgClass { get; set; }
    
    public int? AccessorialChargeGroupId { get; set; }

    public DateTime? DeliverByDateTime { get; set; }

    public string PickupTimeZone { get; set; }

    public string DeliverByTimeZone { get; set; }

    public string RecurringDays { get; set; }

    public string RecurringFrequency { get; set; }
    
    public int? RecurringInitialDays { get; set; }

    public string CubicList { get; set; }

    public string WeightList { get; set; }

    public string BarcodeList { get; set; }
    
    public string RecurringName { get; set; }
}