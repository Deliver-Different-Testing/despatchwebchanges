#nullable enable

namespace DespatchWeb.Models.Response;

public sealed class ArchivedCourierChangeEligibilityResponse
{
    public bool CanChange { get; init; }

    /// <summary>Why the change is blocked: "invoiced", "settled" or "notArchived"; null when changeable.</summary>
    public string? Reason { get; init; }

    public int? CurrentCourierId { get; init; }
    public string? CurrentCourierName { get; init; }
}
