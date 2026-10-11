namespace DespatchWeb.Models.Split;

/// <summary>
/// The job numbers and letter suffixes generated for a split's two new legs.
/// </summary>
public sealed record ChildJobNumbers(
    string PickupJobNumber,
    string PickupSuffix,
    string DeliveryJobNumber,
    string DeliverySuffix);
