#nullable enable

namespace DespatchWeb.Models;

/// <summary>
/// Whether the paid courier on an archived job can still be changed, and who holds it now.
/// The change is blocked once the client invoice is processed or the courier has been settled.
/// </summary>
public sealed record ArchivedCourierChangeEligibility(
    bool IsInvoiced,
    bool IsSettled,
    bool IsDone,
    int? CurrentCourierId,
    string? CurrentCourierName)
{
    public bool CanChange => !IsInvoiced && !IsSettled;
}
