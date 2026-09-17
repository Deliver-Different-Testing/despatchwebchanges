#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Reporting;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <inheritdoc />
public class PricingBreakdownAllocationService : IPricingBreakdownAllocationService
{
    /// <inheritdoc />
    public async Task RewriteAllocationsForParentAsync(
        DespatchContext context,
        int parentJobId,
        IReadOnlyDictionary<(int ParentPricingBreakdownId, int LegJobId), decimal>? seedSharePercents = null,
        IReadOnlyList<int>? currentLegIds = null,
        IReadOnlyDictionary<(int ParentPricingBreakdownId, int LegJobId), decimal>? seedCostOverrides = null,
        CancellationToken ct = default)
    {
        seedSharePercents ??= new Dictionary<(int, int), decimal>();
        seedCostOverrides ??= new Dictionary<(int, int), decimal>();

        // The parent's own rows only — a job predating this feature may still carry legacy
        // ChildJobId-attributed "Part A"/"Part B" rows on the same JobId, and those must never be
        // mistaken for the parent's own items.
        // AsNoTracking: callers write the triggering edit via ExecuteUpdateAsync (bypasses the
        // change tracker), so a tracking read here could hand back a stale identity-mapped instance
        // instead of the value that was just written.
        var parentItems = await context.PricingBreakdowns
            .AsNoTracking()
            .Where(p => p.JobId == parentJobId && p.ChildJobId == null)
            .ToListAsync(ct);

        // A split parent's own ParentId is set to itself (see SplitJobService.SplitJobAsync) as the
        // "I am a split parent, not just unsplit" sentinel — excluded explicitly so self-discovery
        // never mistakes the root for one of its own legs.
        var legIds = currentLegIds is not null
            ? [.. currentLegIds]
            : await context.TucJobs
                .Where(j => j.ParentId == parentJobId && j.UcjbId != parentJobId && !j.UcjbVoid)
                .Select(j => j.UcjbId)
                .ToListAsync(ct);

        if (parentItems.Count == 0 || legIds.Count == 0)
        {
            return;
        }

        var itemIds = parentItems.Select(p => p.PricingBreakdownId).ToList();
        var existingRows = await context.PricingBreakdownAllocations
            .AsTracking()
            .Where(a => itemIds.Contains(a.ParentPricingBreakdownId))
            .ToListAsync(ct);

        var existingByItemLeg = existingRows.ToDictionary(a => (a.ParentPricingBreakdownId, a.LegJobId));

        // A leg that is no longer live has no place in the grid — its rows go, cascade or not.
        var staleRows = existingRows.Where(a => !legIds.Contains(a.LegJobId)).ToList();
        if (staleRows.Count > 0)
        {
            context.PricingBreakdownAllocations.RemoveRange(staleRows);
        }

        // §7.1's "default a new item to the overall leg share": the average, per leg, of whatever
        // shares its sibling items already carry for that leg. Falls back to an equal split when the
        // leg has no rows at all yet (the very first item on a freshly split job with no seeds).
        var siblingAverageByLeg = legIds.ToDictionary(legId => legId, legId =>
        {
            var siblingShares = existingRows.Where(a => a.LegJobId == legId && !staleRows.Contains(a))
                .Select(a => a.SharePercent)
                .ToList();
            return siblingShares.Count > 0 ? siblingShares.Average() : 100m / legIds.Count;
        });

        var legTotals = legIds.ToDictionary(legId => legId, _ => (Revenue: 0m, Fuel: 0m, CostSum: 0m, AnyCost: false));
        var newRows = new List<PricingBreakdownAllocation>();

        foreach (var item in parentItems)
        {
            var shares = new decimal[legIds.Count];
            var rows = new PricingBreakdownAllocation?[legIds.Count];

            for (var i = 0; i < legIds.Count; i++)
            {
                var legId = legIds[i];
                if (existingByItemLeg.TryGetValue((item.PricingBreakdownId, legId), out var existing) && !staleRows.Contains(existing))
                {
                    rows[i] = existing;
                    shares[i] = existing.SharePercent;
                }
                else
                {
                    shares[i] = seedSharePercents.TryGetValue((item.PricingBreakdownId, legId), out var seeded)
                        ? seeded
                        : siblingAverageByLeg[legId];
                }
            }

            var fractions = shares.Select(s => s / 100m).ToList();
            var revenues = PricingBreakdownAllocationCalculator.DistributeAmount(item.ChargeAmount, fractions);
            var derivedCosts = item.CostAmount.HasValue
                ? PricingBreakdownAllocationCalculator.DistributeAmount(item.CostAmount.Value, fractions)
                : null;

            var isFuel = PriceLineClassifier.Classify(item.ChargeName ?? string.Empty) == PriceLineClassifier.Bucket.Fuel;

            for (var i = 0; i < legIds.Count; i++)
            {
                var legId = legIds[i];
                var existing = rows[i];
                // seedCostOverrides only ever seeds a genuinely new (item, leg) pair, exactly like
                // seedSharePercents — an existing row's own persisted CostOverride always wins.
                var costOverride = existing is not null
                    ? existing.CostOverride
                    : seedCostOverrides.TryGetValue((item.PricingBreakdownId, legId), out var seededCost)
                        ? seededCost
                        : (decimal?)null;
                var cost = costOverride ?? derivedCosts?[i];

                if (existing is not null)
                {
                    existing.ChargeAmount = revenues[i];
                    existing.CostAmount = cost;
                    existing.IsAccessorial = item.IsAccessorial;
                }
                else
                {
                    newRows.Add(new PricingBreakdownAllocation
                    {
                        ParentPricingBreakdownId = item.PricingBreakdownId,
                        LegJobId = legId,
                        SharePercent = shares[i],
                        ChargeAmount = revenues[i],
                        CostAmount = cost,
                        CostOverride = costOverride,
                        IsAccessorial = item.IsAccessorial,
                    });
                }

                var totals = legTotals[legId];
                totals.Revenue += revenues[i];
                if (isFuel)
                {
                    totals.Fuel += revenues[i];
                }
                if (cost.HasValue)
                {
                    totals.CostSum += cost.Value;
                    totals.AnyCost = true;
                }
                legTotals[legId] = totals;
            }
        }

        if (newRows.Count > 0)
        {
            context.PricingBreakdownAllocations.AddRange(newRows);
        }

        await context.SaveChangesAsync(ct);

        // TotalDistance and RatedManually are both left untouched: this is a re-price, not a new
        // split, and RatedManually specifically must survive — a caller that wants a manually-rated
        // leg excluded from automatic redistribution (see SplitJobService) depends on this rewrite
        // never clearing the very flag that got it excluded. A brand-new leg gets RatedManually set
        // to false by its caller (AllocateSplitPricingAsync), not here.
        foreach (var legId in legIds)
        {
            var totals = legTotals[legId];
            await context.TucJobs
                .Where(j => j.UcjbId == legId)
                .ExecuteUpdateAsync(j => j
                    .SetProperty(x => x.UcjbAmount, totals.Revenue)
                    .SetProperty(x => x.FuelSurchargeAmount, totals.Fuel)
                    .SetProperty(x => x.CourierPayment, totals.AnyCost ? totals.CostSum : (decimal?)null), ct);
        }
    }
}
