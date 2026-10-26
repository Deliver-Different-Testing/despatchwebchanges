namespace DespatchWeb.Enums;

/// <summary>
/// tucJobItems.ItemStatus (#860/#861). Flagged lines stay on the job but no longer count toward its
/// qty / weight / cubic (trg_UpdateLiveJobTotals). NULL in the database reads as Active.
/// </summary>
public enum JobItemStatus : byte
{
    Active = 0,

    /// <summary>The driver picked up without it (pickup screen "Not present").</summary>
    NotPickedUp = 1,

    /// <summary>Removed in Dispatch after the job was sent to a driver.</summary>
    NotForDelivery = 2
}
