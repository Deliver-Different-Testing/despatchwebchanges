namespace DespatchWeb.Enums;

/// <summary>
/// Coarse-grained lifecycle stage used by <see cref="DespatchWeb.Interfaces.IJobChangePolicyService"/>
/// to decide whether a field change is auto-applied, requires approval, or is prohibited.
/// Maps from <c>tucJob.UcjbStatus</c> ranges, not 1:1 with <see cref="JobStatus"/>.
/// SettlementInclusive (post-settlement rate lock) is deliberately omitted in v1 — there
/// is no signal on <c>tucJob</c> indicating settlement inclusion yet. Add the stage and
/// wire its trigger when a settlement boundary becomes available.
/// </summary>
public enum JobLifecycleStage
{
    /// <summary>Booked but not yet allocated to a courier.</summary>
    PreAllocation,
    /// <summary>Allocated and pre-pickup.</summary>
    Allocated,
    /// <summary>Courier has picked up the consignment.</summary>
    InTransit,
    /// <summary>Delivered and POD captured.</summary>
    Delivered
}
