namespace DespatchWeb.Enums;

/// <summary>
/// Status values for <c>tucJobChangeRequest.ujcrStatus</c>. Kept as string constants
/// (not an enum) because the column is varchar and several queries filter on these
/// values directly — keeping the source-of-truth here prevents drift between query
/// strings and writes.
/// </summary>
public static class JobChangeRequestStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Applied = "Applied";

    /// <summary>
    /// Originator-retracted before resolution. Set by CancelAsync on the local row; the
    /// peer is notified via a Decision=Cancelled forward so its mirror row matches.
    /// Terminal — Pending → Cancelled never transitions further.
    /// </summary>
    public const string Cancelled = "Cancelled";
}
