using System;
using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class CreateMinimalTucJobInputModel
{
    [Required] public string JobNumber { get; init; }

    [Required] public AddressViewModel FromAddress { get; init; }

    [Required] public AddressViewModel ToAddress { get; init; }

    [Required] public string BookedBy { get; init; }

    [Required] public int ClientId { get; init; }

    public int? AgentCourierId { get; init; }

    [Required] public int SpeedId { get; init; }

    [Required] public decimal Amount { get; init; }

    public string Reference { get; init; }

    public string ReferenceB { get; init; }

    public string Notes { get; init; }

    [Required] public DateTime TenantCurrentTime { get; init; }

    [Required] public int LoggedInContactId { get; init; }

    public string Speed { get; init; }

    public string ToAddressType { get; init; }

    public int? VehicleSizeId { get; init; }

    public string PickupNotes { get; init; }

    public string DeliveryNotes { get; init; }

    public string FromContactName { get; init; }

    public string FromPhoneNumber { get; init; }

    public string ToContactName { get; init; }

    public string ToPhoneNumber { get; init; }

    public string Type { get; init; }

    public string JobNotificationType { get; init; }

    public string JobNotificationEmail { get; init; }

    public string JobNotificationMobile { get; init; }

    public bool Hold { get; init; } = false;

    public decimal? FuelSurchargeAmount { get; init; }

    public string OurRef { get; init; }

    public decimal? PickUpLatitude { get; init; }

    public decimal? PickUpLongitude { get; init; }

    public decimal? DeliveryLatitude { get; init; }

    public decimal? DeliveryLongitude { get; init; }

    public DateTime? Pickup { get; init; }

    public bool? PrivateRes { get; init; }

    public int? TotalPallets { get; init; }

    public decimal? DryIceWeight { get; init; }

    public decimal? Cubic { get; init; }

    public int? DgClass { get; init; }

    public int? AccessorialChargeGroupId { get; init; }

    public DateTime? DeliverByDateTime { get; init; }

    public string PickupTimeZone { get; init; }

    public string DeliverByTimeZone { get; init; }

    public string RecurringDays { get; init; }

    public string RecurringFrequency { get; init; }

    public int? RecurringInitialDays { get; init; }

    public string CubicList { get; init; }

    public string WeightList { get; init; }

    public string BarcodeList { get; init; }

    public string RecurringName { get; init; }
}