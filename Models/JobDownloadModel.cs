using System;

namespace DespatchWeb.Models;

public class JobDownloadModel
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public string JobNumber { get; set; }
    public DateTime BookDate { get; set; }
    public decimal? Amount { get; set; }
    public decimal Fuel { get; set; }
    public decimal? Ppd { get; set; }
    public decimal? CourierPayment { get; set; }
    public decimal? CourierFuel { get; set; }
    public decimal? CourierBonus { get; set; }
    public short? Quantity { get; set; }
    public double? Weight { get; set; }
    public int? Size { get; set; }
    public string PickupAddressLine1 { get; set; }
    public string PickupAddressLine2 { get; set; }
    public string PickupAddressLine3 { get; set; }
    public string PickupAddressLine4 { get; set; }
    public string PickupAddressLine5 { get; set; }
    public string PickupAddressLine6 { get; set; }
    public string PickupAddressLine7 { get; set; }
    public string PickupAddressLine8 { get; set; }
    public string DeliveryAddressLine1 { get; set; }
    public string DeliveryAddressLine2 { get; set; }
    public string DeliveryAddressLine3 { get; set; }
    public string DeliveryAddressLine4 { get; set; }
    public string DeliveryAddressLine5 { get; set; }
    public string DeliveryAddressLine6 { get; set; }
    public string DeliveryAddressLine7 { get; set; }
    public string DeliveryAddressLine8 { get; set; }
    public string ClientReferenceA { get; set; }
    public string ClientReferenceB { get; set; }
    public string ClientReferenceC { get; set; }
}
