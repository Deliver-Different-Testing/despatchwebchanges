#nullable enable
using DespatchWeb.Enums;

namespace DespatchWeb.Models.Response;

/// <summary>
/// Outcome of assigning one job inside a bulk assignment. A job that fails is
/// reported rather than thrown so a single stale row in the operator's selection
/// cannot lose the rest of the batch.
/// </summary>
/// <param name="EmailStatus">
/// Inbound-agent email outcome; null for network partner assignments, which send nothing.
/// </param>
public sealed record BulkAssignmentResult(
    int JobId,
    bool Succeeded,
    string? FailureReason,
    AgentInboundEmailStatus? EmailStatus);
