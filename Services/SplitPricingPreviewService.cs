using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Proposes how a job's pricing breakdown would divide across the two legs of a split, for the user
/// to confirm before anything is written.
/// </summary>
/// <remarks>
/// The legs don't exist yet, so the per-leg rating engine isn't available here. The basis chain is
/// road miles → straight-line miles → even split; whatever the user confirms is then sent back and
/// applied verbatim, so the figures shown are the figures written.
/// </remarks>
public class SplitPricingPreviewService(
    IDbContextFactory<DespatchContext> contextFactory,
    IRateJobService rateJobService,
    ITenantInfoService tenantInfoService) : ISplitPricingPreviewService
{
    /// <summary>Kilometres per mile — the routing engine answers in miles whatever the tenant.</summary>
    private const decimal KilometresPerMile = 1.609344m;

    /// <inheritdoc />
    public async Task<SplitPricingPreviewDto> PreviewAsync(
        int jobId,
        AddressViewModel meetingPointAddress,
        CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);

        var job = await context.TucJobs.FirstOrDefaultAsync(j => j.UcjbId == jobId, ct)
                  ?? throw new InvalidOperationException($"Job {jobId} not found");

        // Breakdown lines hang off the effective (root) job. Re-splitting a leg divides that leg's
        // own child-attributed rows rather than the root's whole set.
        var effectiveParentId = job.ParentId ?? job.UcjbId;
        var sourceChildJobId = effectiveParentId == job.UcjbId ? (int?)null : job.UcjbId;

        var sourceLines = await context.PricingBreakdowns
            .Where(p => p.JobId == effectiveParentId && p.ChildJobId == sourceChildJobId)
            .Select(p => new SplitPricingAllocator.ParentLine(
                p.PricingBreakdownId, p.ChargeName ?? string.Empty, p.ChargeAmount, p.CostAmount,
                p.IsAccessorial))
            .ToListAsync(ct);

        var parentAmount = job.UcjbAmount ?? 0m;
        var linesToDivide = SplitPricingAllocator.EnsureLines(sourceLines, parentAmount, job.CourierPayment);

        var childNumbers = await SplitJobService.GenerateChildJobNumbersAsync(context, job, ct);

        // Leg 1 runs pickup → meeting point; leg 2 meeting point → delivery.
        var legCoords = new[]
        {
            (From: (job.PickUpLatitude, job.PickUpLongitude),
                To: (meetingPointAddress.Latitude, meetingPointAddress.Longitude)),
            (From: (meetingPointAddress.Latitude, meetingPointAddress.Longitude),
                To: (job.DeliveryLatitude, job.DeliveryLongitude))
        };

        var (miles, basis) = await ResolveMilesAsync(legCoords);

        var legs = new[]
        {
            new SplitPricingAllocator.LegWeight(1, childNumbers.PickupSuffix, miles[0]),
            new SplitPricingAllocator.LegWeight(2, childNumbers.DeliverySuffix, miles[1])
        };

        var shares = SplitPricingAllocator.Shares(legs);
        var allocated = SplitPricingAllocator.Allocate(linesToDivide, legs);
        var jobNumbers = new[] { childNumbers.PickupJobNumber, childNumbers.DeliveryJobNumber };

        // Distances are computed and weighted in miles throughout — the shares are ratios, so the
        // unit cancels out. It only matters for the figure shown to the user.
        var isUs = tenantInfoService.IsUsTenant();

        var legDtos = legs.Select((leg, i) =>
        {
            var legLines = allocated.Where(l => l.LetterSuffix == leg.LetterSuffix).ToList();
            return new SplitPricingLegDto
            {
                Sequence = leg.Sequence,
                LetterSuffix = leg.LetterSuffix,
                JobNumber = jobNumbers[i],
                Distance = Math.Round(
                    isUs ? leg.Miles : leg.Miles * KilometresPerMile, 2, MidpointRounding.AwayFromZero),
                SharePercent = Math.Round(shares[i] * 100m, 2, MidpointRounding.AwayFromZero),
                TotalRevenue = legLines.Sum(l => l.ChargeAmount),
                TotalCost = legLines.Sum(l => l.CostAmount ?? 0m),
                Lines =
                [
                    .. legLines
                        .Select(l => new SplitPricingLineDto
                        {
                            PricingBreakdownId = l.PricingBreakdownId,
                            Name = l.ChargeName,
                            Revenue = l.ChargeAmount,
                            Cost = l.CostAmount ?? 0m
                        })
                ]
            };
        }).ToList();

        return new SplitPricingPreviewDto
        {
            Basis = basis.ToString(),
            DistanceUnit = isUs ? "mi" : "km",
            ParentTotalRevenue = linesToDivide.Sum(l => l.ChargeAmount),
            ParentTotalCost = linesToDivide.Sum(l => l.CostAmount ?? 0m),
            IsSynthesised = sourceLines.Count == 0,
            ParentLines =
            [
                .. linesToDivide
                    .Select(l => new SplitPricingParentLineDto
                    {
                        PricingBreakdownId = l.PricingBreakdownId,
                        Name = l.ChargeName,
                        Revenue = l.ChargeAmount,
                        Cost = l.CostAmount ?? 0m,
                        IsAccessorial = l.IsAccessorial
                    })
            ],
            Legs = legDtos
        };
    }

    private async Task<(List<decimal> Miles, SplitPricingAllocator.AllocationBasis Basis)> ResolveMilesAsync(
        ((decimal? Lat, decimal? Lng) From, (decimal? Lat, decimal? Lng) To)[] legCoords)
    {
        var roadMiles = new List<decimal>(legCoords.Length);
        foreach (var (from, to) in legCoords)
        {
            roadMiles.Add((decimal)await rateJobService.GetRoadDistanceMilesAsync(
                from.Lat, from.Lng, to.Lat, to.Lng));
        }

        if (roadMiles.Sum() > 0m)
        {
            return (roadMiles, SplitPricingAllocator.AllocationBasis.RoadMiles);
        }

        var straightLine = legCoords
            .Select(c => DistanceCalculator.MilesOrZero(c.From.Lat, c.From.Lng, c.To.Lat, c.To.Lng))
            .ToList();

        return straightLine.Sum() > 0m
            ? (straightLine, SplitPricingAllocator.AllocationBasis.StraightLine)
            : (legCoords.Select(_ => 0m).ToList(), SplitPricingAllocator.AllocationBasis.EvenSplit);
    }
}
