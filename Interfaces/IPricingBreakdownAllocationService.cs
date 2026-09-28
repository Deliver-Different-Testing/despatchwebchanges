#nullable enable
using DespatchWeb.EntityClasses;

namespace DespatchWeb.Interfaces;

/// <summary>
/// The single write path for a split parent job's <c>PricingBreakdownAllocation</c> rows (docs/
/// pricing/job-splitting-price-breakdown.md). The parent's own <c>PricingBreakdown</c> rows are the
/// only editable price surface; every leg's derived revenue/cost is recomputed from them here,
/// whenever a parent item, its share, or a leg's cost override changes.
/// </summary>
public interface IPricingBreakdownAllocationService
{
    /// <summary>
    /// Recomputes every allocation row for <paramref name="parentJobId"/>'s own price items against
    /// its current live (non-void) legs, in one pass:
    /// <list type="bullet">
    /// <item>An existing (item, leg) row keeps its own <c>SharePercent</c>/<c>CostOverride</c> and
    /// only has <c>ChargeAmount</c>/<c>CostAmount</c> re-derived.</item>
    /// <item>A (item, leg) pair with no row yet is seeded — from <paramref name="seedSharePercents"/>
    /// when supplied for that pair (the initial split, where the user confirmed explicit shares),
    /// else from the average of the item's sibling items' shares for that leg (a new item added to
    /// an already-split job, §7.1 "default to the overall leg share"), else an equal split when the
    /// item has no siblings on this leg either.</item>
    /// <item>A leg no longer live is dropped — its allocation rows are removed.</item>
    /// </list>
    /// Revenue is distributed by each item's per-leg shares (largest-share leg absorbs the rounding
    /// remainder, §4.6); cost the same way, except a leg with <c>CostOverride</c> set keeps that
    /// value exactly, regardless of what its share-derived cost would have been (§4.4/§4.5 — a cost
    /// override never changes revenue, and a revenue/share edit never clears a cost override).
    /// Each leg's header (<c>UcjbAmount</c>/<c>FuelSurchargeAmount</c>/<c>CourierPayment</c>) is
    /// written from the result; <c>TotalDistance</c> is left untouched.
    /// <para>
    /// Runs on the caller's already-open <paramref name="context"/> — does not begin its own
    /// transaction, so it composes inside both the split transaction and a later single-field-edit
    /// transaction. Does not call <c>SaveChangesAsync</c> beyond what it needs to read back
    /// identities for newly inserted rows; the caller commits.
    /// </para>
    /// </summary>
    /// <param name="context">The caller's open context/transaction.</param>
    /// <param name="parentJobId">The split parent job whose allocations to rewrite.</param>
    /// <param name="seedSharePercents">
    /// Explicit shares (0-100) for (item, leg) pairs that don't have a row yet, keyed by
    /// (ParentPricingBreakdownId, LegJobId). Used at split time, when every pair is new and the user
    /// has already confirmed shares in the split dialog; omit for a routine parent-side edit.
    /// </param>
    /// <param name="currentLegIds">
    /// Overrides which legs are "current" instead of self-discovering via
    /// <c>TucJob.ParentId == parentJobId</c>. Needed when re-splitting an already-split leg further:
    /// the leg being re-split has no <c>PricingBreakdown</c> rows of its own to anchor a nested
    /// allocation to, so its two new sub-legs are seeded directly against the root's items instead,
    /// and the root's "current legs" become its other direct children plus the two new sub-legs —
    /// not what <c>TucJob.ParentId == parentJobId</c> alone would find, since the sub-legs' own
    /// <c>ParentId</c> is the leg being replaced, not the root. Omit for the ordinary case.
    /// </param>
    /// <param name="seedCostOverrides">
    /// Explicit cost overrides for (item, leg) pairs that don't have a row yet, keyed the same way as
    /// <paramref name="seedSharePercents"/> — a driver paid a fixed amount at split time regardless of
    /// the revenue split. Like <paramref name="seedSharePercents"/>, never applied to an existing row:
    /// that row's own persisted <c>CostOverride</c> always wins. Omit for a routine parent-side edit.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    Task RewriteAllocationsForParentAsync(
        DespatchContext context,
        int parentJobId,
        IReadOnlyDictionary<(int ParentPricingBreakdownId, int LegJobId), decimal>? seedSharePercents = null,
        IReadOnlyList<int>? currentLegIds = null,
        IReadOnlyDictionary<(int ParentPricingBreakdownId, int LegJobId), decimal>? seedCostOverrides = null,
        CancellationToken ct = default);

    /// <summary>
    /// The archive-table counterpart of <see cref="RewriteAllocationsForParentAsync"/>: re-derives
    /// every PricingBreakdownAllocationArchive row's ChargeAmount/CostAmount from the parent's
    /// archived items and the rows' own SharePercent/CostOverride, then writes each leg's
    /// UcjbAmount, FuelSurchargeAmount and CourierPayment. Only rewrites existing rows — it never
    /// seeds or removes one, so the caller must have checked every (item, leg) pair has a row.
    /// </summary>
    /// <param name="context">The caller's open context/transaction.</param>
    /// <param name="parentJobId">The archived split parent whose allocations to rewrite.</param>
    /// <param name="currentLegIds">The parent's current (non-void) legs, live or archived.</param>
    /// <param name="ct">Cancellation token.</param>
    Task RewriteArchivedAllocationsForParentAsync(
        DespatchContext context,
        int parentJobId,
        IReadOnlyList<int> currentLegIds,
        CancellationToken ct = default);
}
