#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// Which editable surfaces of a split parent's price breakdown are still open, per
/// docs/pricing/job-splitting-price-breakdown.md §7.5. Revenue and Share lock once the
/// parent is invoiced; Share also locks the moment any leg settles (it moves revenue
/// *and* cost). Each leg's own cost locks independently, only once that leg is settled.
/// </summary>
public sealed record SplitPricingLockState(
    bool RevenueLocked,
    string? RevenueLockReason,
    bool ShareLocked,
    string? ShareLockReason,
    IReadOnlyDictionary<int, SplitPricingLegCostLock> PerLegCostLocks);

public sealed record SplitPricingLegCostLock(bool Locked, string? Reason);
