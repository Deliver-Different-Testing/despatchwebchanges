namespace DespatchWeb.Models;

public sealed class UrgentRerateObject
{
    public int SpeedId { get; init; }
    public int SizeId { get; init; }
    public UrgentRerateAddressObject From { get; init; }
    public UrgentRerateAddressObject To { get; init; }
    public IEnumerable<UrgentPackageObject> Packages { get; init; }
    public int Weight { get; init; }
    public int Quantity { get; init; }
    public bool? IsDangerousGoods { get; init; }
    public int? DGClass { get; init; }
    public decimal? DryIceWeight { get; init; }
    public bool? IsPrebook { get; init; }
    public DateTime? DateTime { get; init; }
    public bool? Van { get; init; }
    public bool? Bike { get; init; }
    public UrgentTruckObject Truck { get; init; }
    public string OurReference { get; init; }
    public string ClientReferenceA { get; init; }
    public string ClientReferenceB { get; init; }
    public int? BulkScheduleId { get; init; }
}
