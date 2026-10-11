#nullable enable
namespace DespatchWeb.Models.RequestModels;

/// <summary>Payload from the React UI to <c>POST /JobChangeRequest/Create</c>.</summary>
public sealed class CreateJobChangeRequestRequest
{
    public int JobId { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string? CurrentValue { get; init; }
    public string? RequestedValue { get; init; }
    public string? Reason { get; init; }

    /// <summary>
    /// Pairing the job was dispatched on. Optional for back-compat — when omitted, the
    /// service requires the tenant to have exactly one active pairing and errors otherwise.
    /// </summary>
    public int? PairingId { get; init; }
}
