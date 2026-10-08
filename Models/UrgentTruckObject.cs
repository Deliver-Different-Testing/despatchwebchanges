namespace DespatchWeb.Models;

public sealed class UrgentTruckObject
{
    public bool? PickupTailLift { get; init; }
    public bool? DropoffTailLift { get; init; }
    public bool? PrivateRes { get; init; }
    public bool? HasDgDocuments { get; init; }
    public string TruckStartTime { get; init; }
    public int? TruckHours { get; init; }
}
