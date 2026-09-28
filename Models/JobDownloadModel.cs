namespace DespatchWeb.Models;

public sealed class JobDownloadModel
{
    public int Id { get; init; }
    public int? ParentId { get; init; }
    public string JobNumber { get; init; }
    public DateTime BookDate { get; init; }
    public decimal? Amount { get; init; }
    public decimal Fuel { get; init; }
    public decimal? Ppd { get; init; }
    public decimal? CourierPayment { get; init; }
    public decimal? CourierFuel { get; init; }
    public decimal? CourierBonus { get; init; }
    public short? Quantity { get; init; }
    public double? Weight { get; init; }
    public int? Size { get; init; }
    public string PickupAddressLine1 { get; init; }
    public string PickupAddressLine2 { get; init; }
    public string PickupAddressLine3 { get; init; }
    public string PickupAddressLine4 { get; init; }
    public string PickupAddressLine5 { get; init; }
    public string PickupAddressLine6 { get; init; }
    public string PickupAddressLine7 { get; init; }
    public string PickupAddressLine8 { get; init; }
    public string DeliveryAddressLine1 { get; init; }
    public string DeliveryAddressLine2 { get; init; }
    public string DeliveryAddressLine3 { get; init; }
    public string DeliveryAddressLine4 { get; init; }
    public string DeliveryAddressLine5 { get; init; }
    public string DeliveryAddressLine6 { get; init; }
    public string DeliveryAddressLine7 { get; init; }
    public string DeliveryAddressLine8 { get; init; }
    public string ClientReferenceA { get; init; }
    public string ClientReferenceB { get; init; }
    public string ClientReferenceC { get; init; }
    public string CustomerName { get; init; }
    public DateTime? PickedUpDate { get; init; }
    public DateTime? DeliveredDate { get; init; }
    public string AgentAirlineName { get; init; }
    public string AWB { get; init; }
    public string StatusName { get; init; }
    public int? InvoiceNumber { get; init; }
    public DateTime? InvoiceDate { get; init; }
    public bool IsArchived { get; init; }
    public string LoggedInContact { get; init; }
    public decimal? RawBaseAmount { get; init; }
    public string CourierCode { get; init; }
    public bool Void { get; init; }
    public string OurReference { get; init; }
    public string Speed { get; init; }
    public string Notes { get; init; }
}
