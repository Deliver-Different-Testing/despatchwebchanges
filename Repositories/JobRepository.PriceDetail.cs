#nullable enable
using DespatchWeb.Enums;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

// Data access for the Price Detail Report. Models PodSearchDownloadAsync (parallel live+archive,
// 50000/source cap, no paging). Live vs Archive are NOT unified in the schema - query both,
// merge with live precedence. Breakdown / journey / items tables are reached only via IN-lists on
// already-scoped job ids, and those IN-lists are chunked to stay under SQL Server's ~2100
// parameter limit. Project ChargeName / ChargeAmount / CostAmount only (Total / Included /
// Charged are dead columns). FieldName filters use the real casing from JobDeliveryJourney:
// lowercase 'ucjbAmount' and 'ucjbVoid' - confirmed on DFRNT.
public partial class JobRepository
{
    // SQL Server parameter limit is 2100. 2000 leaves headroom for filter params on the same query.
    internal const int PriceDetailInChunkSize = 2000;

    public async Task<PriceDetailReportRaw> GetPriceDetailReportAsync(
        PriceDetailReportRequest request, CancellationToken ct = default)
    {
        const int maxExportRowsPerSource = 50_000;

        var fromDateOnly = request.FromDate.Date;
        var toDateOnly = request.ToDate.Date;
        var wild = request.Wild ?? "";
        var jobText = request.Job ?? "";
        var jobSearch = $"%{jobText.Trim()}%";
        var wildSearch = $"%{wild}%";

        var clientSet = request.ClientIds is { Count: > 0 };
        var courierSet = request.CourierIds is { Count: > 0 };
        var speedSet = request.SpeedIds is { Count: > 0 };
        var jobSet = !string.IsNullOrEmpty(jobText);
        var jobIdSet = request.JobId.HasValue;
        var wildSet = !string.IsNullOrEmpty(wild);

        await using var hdrCtx = await _contextFactory.CreateDbContextAsync(ct);
        await using var pbCtx = await _contextFactory.CreateDbContextAsync(ct);
        await using var jjCtx = await _contextFactory.CreateDbContextAsync(ct);
        await using var itemsCtx = await _contextFactory.CreateDbContextAsync(ct);
        hdrCtx.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));
        pbCtx.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));
        jjCtx.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));
        itemsCtx.Database.SetCommandTimeout(TimeSpan.FromMinutes(5));

        // ---- id sets (mirror PodSearchDownloadAsync's filter build; no paging) --------------

        IQueryable<int> liveIdQuery;
        IQueryable<int> archiveIdQuery;

        if (jobIdSet)
        {
            liveIdQuery = hdrCtx.TucJobs.Where(j => j.UcjbId == request.JobId).Select(j => j.UcjbId);
            archiveIdQuery = hdrCtx.TucJobArchives.Where(j => j.UcjbId == request.JobId).Select(j => j.UcjbId);
        }
        else
        {
            liveIdQuery = hdrCtx.TucJobs
                .Where(j =>
                    j.UcjbDate.Date >= fromDateOnly
                    && j.UcjbDate.Date <= toDateOnly
                    && (!clientSet || (j.UcjbClientId.HasValue && request.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!courierSet || (j.UcjbCourierId.HasValue && request.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!speedSet || (j.UcjbSpeed.HasValue && request.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!jobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                    && (!wildSet ||
                        EF.Functions.Like(
                            j.UcjbNumber + " " + (j.UcjbClientRefa ?? "") + " " + (j.UcjbClientRefb ?? ""),
                            wildSearch)))
                .Select(j => j.UcjbId);

            archiveIdQuery = hdrCtx.TucJobArchives
                .Where(j =>
                    j.UcjbDate.HasValue
                    && j.UcjbDate.Value.Date >= fromDateOnly
                    && j.UcjbDate.Value.Date <= toDateOnly
                    && (!clientSet || (j.UcjbClientId.HasValue && request.ClientIds.Contains(j.UcjbClientId.Value)))
                    && (!courierSet || (j.UcjbCourierId.HasValue && request.CourierIds.Contains(j.UcjbCourierId.Value)))
                    && (!speedSet || (j.UcjbSpeed.HasValue && request.SpeedIds.Contains(j.UcjbSpeed.Value)))
                    && (!jobSet || EF.Functions.Like(j.UcjbNumber, jobSearch))
                    && (!wildSet ||
                        EF.Functions.Like(
                            j.UcjbNumber + " " + (j.UcjbClientRefa ?? "") + " " + (j.UcjbClientRefb ?? ""),
                            wildSearch)))
                .Select(j => j.UcjbId);
        }

        var liveIds = await liveIdQuery.Take(maxExportRowsPerSource)
            .TagWith("PriceDetail - Live Ids").ToListAsync(ct);
        var archiveIds = await archiveIdQuery.Take(maxExportRowsPerSource)
            .TagWith("PriceDetail - Archive Ids").ToListAsync(ct);

        // ---- Headers (live) -----------------------------------------------------------------

        var liveHeaders = await InIdChunksAsync(liveIds, chunk => hdrCtx.TucJobs
            .Where(j => chunk.Contains(j.UcjbId))
            .Select(j => new PriceDetailHeaderRow
            {
                JobId = j.UcjbId,
                JobNo = j.UcjbNumber,
                ClientId = j.UcjbClientId,
                ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : "",
                Reference = j.UcjbClientRefa ?? "",
                Service = j.UcjbSpeedNavigation != null ? (j.UcjbSpeedNavigation.ShortName ?? "") : "",
                HeaderAmount = j.UcjbAmount,
                HeaderFuel = j.FuelSurchargeAmount,
                Void = j.UcjbVoid,
                RatedManually = j.RatedManually,
                BookingParentId = j.BookingParentId,
                Weight = j.UcjbWeight,
                Cubic = j.Cubic,
                Qty = j.UcjbQty,
                TotalDistance = j.TotalDistance,
                BookedAt = j.UcjbDate,
                PickedUpAt = j.PickUpTime,
                DeliveredAt = j.UcjbComplTime,
                PickupArrivalUtc = j.PickupArrivalTime,
                DeliveryArrivalUtc = j.DeliveryArrivalTime,
                PickupTimeUtc = j.PickUpTime,
                CompletionUtc = j.UcjbComplTime,
                PickupAddress = ((j.PickupAddressLine3 ?? "") + " " + (j.PickupAddressLine4 ?? "") + ", " +
                                 (j.PickupAddressLine5 ?? "") + ", " + (j.PickupAddressLine6 ?? "")).Trim(),
                DeliveryAddress = ((j.DeliveryAddressLine3 ?? "") + " " + (j.DeliveryAddressLine4 ?? "") + ", " +
                                   (j.DeliveryAddressLine5 ?? "") + ", " + (j.DeliveryAddressLine6 ?? "")).Trim()
            })
            .TagWith("PriceDetail - Live Headers").ToListAsync(ct));

        // Archive table has no client / speed nav - fetch them separately below.
        var archiveHeadersRaw = await InIdChunksAsync(archiveIds, chunk => hdrCtx.TucJobArchives
            .Where(j => chunk.Contains(j.UcjbId))
            .Select(j => new
            {
                j.UcjbId, j.UcjbNumber, j.UcjbClientId, j.UcjbSpeed,
                Reference = j.UcjbClientRefa ?? "",
                HeaderAmount = j.UcjbAmount,
                HeaderFuel = j.FuelSurchargeAmount,
                Void = j.UcjbVoid,
                j.RatedManually, j.BookingParentId, j.UcjbWeight, j.Cubic, j.UcjbQty, j.TotalDistance,
                j.UcjbDate, j.PickUpTime, j.UcjbComplTime, j.PickupArrivalTime, j.DeliveryArrivalTime,
                j.PickupAddressLine3, j.PickupAddressLine4, j.PickupAddressLine5, j.PickupAddressLine6,
                j.DeliveryAddressLine3, j.DeliveryAddressLine4, j.DeliveryAddressLine5, j.DeliveryAddressLine6
            })
            .TagWith("PriceDetail - Archive Headers").ToListAsync(ct));

        var clientIdsForLookup = archiveHeadersRaw.Where(x => x.UcjbClientId.HasValue)
            .Select(x => x.UcjbClientId!.Value).Distinct().ToList();
        var speedIdsForLookup = archiveHeadersRaw.Where(x => x.UcjbSpeed.HasValue).Select(x => x.UcjbSpeed!.Value)
            .Distinct().ToList();
        var clientNames = await InIdChunksAsync(clientIdsForLookup, chunk => hdrCtx.TucClients
            .Where(c => chunk.Contains(c.UcclId))
            .Select(c => new { c.UcclId, c.UcclName })
            .ToListAsync(ct));
        var clientNameMap = clientNames.ToDictionary(c => c.UcclId, c => c.UcclName ?? "");
        var speedNames = await InIdChunksAsync(speedIdsForLookup, chunk => hdrCtx.TucJobTypes
            .Where(s => chunk.Contains(s.UcjtId))
            .Select(s => new { s.UcjtId, s.ShortName })
            .ToListAsync(ct));
        var speedNameMap = speedNames.ToDictionary(s => s.UcjtId, s => s.ShortName ?? "");

        var archiveHeaders = archiveHeadersRaw.Select(j => new PriceDetailHeaderRow
        {
            JobId = j.UcjbId,
            JobNo = j.UcjbNumber,
            ClientId = j.UcjbClientId,
            ClientName = j.UcjbClientId.HasValue && clientNameMap.TryGetValue(j.UcjbClientId.Value, out var cn)
                ? cn
                : "",
            Reference = j.Reference,
            Service = j.UcjbSpeed.HasValue && speedNameMap.TryGetValue(j.UcjbSpeed.Value, out var sn) ? sn : "",
            HeaderAmount = j.HeaderAmount,
            HeaderFuel = j.HeaderFuel,
            Void = j.Void,
            RatedManually = j.RatedManually,
            BookingParentId = j.BookingParentId,
            Weight = j.UcjbWeight,
            Cubic = j.Cubic,
            Qty = j.UcjbQty,
            TotalDistance = j.TotalDistance,
            BookedAt = j.UcjbDate,
            PickedUpAt = j.PickUpTime,
            DeliveredAt = j.UcjbComplTime,
            PickupArrivalUtc = j.PickupArrivalTime,
            DeliveryArrivalUtc = j.DeliveryArrivalTime,
            PickupTimeUtc = j.PickUpTime,
            CompletionUtc = j.UcjbComplTime,
            PickupAddress = ((j.PickupAddressLine3 ?? "") + " " + (j.PickupAddressLine4 ?? "") + ", " +
                             (j.PickupAddressLine5 ?? "") + ", " + (j.PickupAddressLine6 ?? "")).Trim(),
            DeliveryAddress = ((j.DeliveryAddressLine3 ?? "") + " " + (j.DeliveryAddressLine4 ?? "") + ", " +
                               (j.DeliveryAddressLine5 ?? "") + ", " + (j.DeliveryAddressLine6 ?? "")).Trim()
        }).ToList();

        // ---- Dims from tucJobItems / tucJobItemsArchive -------------------------------------
        // 100% populated on DFRNT; format one item as "N HU, LxWxH, X lb" and join multiple with "; ".

        var liveItems = await InIdChunksAsync(liveIds, chunk => itemsCtx.TucJobItems
            .Where(i => chunk.Contains(i.JobId))
            .Select(i => new { i.JobId, i.Items, i.Weight, i.Length, i.Depth, i.Height })
            .TagWith("PriceDetail - Live Items").ToListAsync(ct));
        var archiveItems = await InIdChunksAsync(archiveIds, chunk => itemsCtx.TucJobItemsArchives
            .Where(i => chunk.Contains(i.JobId))
            .Select(i => new { i.JobId, i.Items, i.Weight, i.Length, i.Depth, i.Height })
            .TagWith("PriceDetail - Archive Items").ToListAsync(ct));

        var dimsByJob = liveItems.Concat(archiveItems)
            .GroupBy(i => i.JobId)
            .ToDictionary(g => g.Key, g => string.Join("; ", g.Select(i =>
                FormatDim(i.Items, i.Length, i.Depth, i.Height, i.Weight))));

        foreach (var h in liveHeaders)
            if (dimsByJob.TryGetValue(h.JobId, out var d))
                h.Dims = d;
        foreach (var h in archiveHeaders)
            if (dimsByJob.TryGetValue(h.JobId, out var d))
                h.Dims = d;

        // ---- Current lines ------------------------------------------------------------------

        var liveLines = await InIdChunksAsync(liveIds, chunk => pbCtx.PricingBreakdowns
            .Where(p => p.JobId != null && chunk.Contains(p.JobId.Value))
            .Select(p => new PriceDetailLineRow
            {
                JobId = p.JobId!.Value,
                ChildJobId = p.ChildJobId,
                ChargeName = p.ChargeName ?? string.Empty,
                ChargeAmount = p.ChargeAmount,
                CourierPay = p.CostAmount
            })
            .TagWith("PriceDetail - Live Lines").ToListAsync(ct));

        var archiveLines = await InIdChunksAsync(archiveIds, chunk => pbCtx.PricingBreakdownArchives
            .Where(p => p.JobId != null && chunk.Contains(p.JobId.Value))
            .Select(p => new PriceDetailLineRow
            {
                JobId = p.JobId!.Value,
                ChargeName = p.ChargeName ?? string.Empty,
                ChargeAmount = p.ChargeAmount,
                CourierPay = p.CostAmount
            })
            .TagWith("PriceDetail - Archive Lines").ToListAsync(ct));

        // ---- Pricing history ----------------------------------------------------------------

        var liveHistory = await InIdChunksAsync(liveIds, chunk => jjCtx.JobDeliveryJourneys
            .Where(s => chunk.Contains(s.JobId)
                        && (s.ChangeType == nameof(DeliveryJourneyChangeType.JobCreated)
                            || (s.ChangeType == nameof(DeliveryJourneyChangeType.JobUpdate)
                                && s.FieldName != null
                                && (s.FieldName == "PricingBreakdown"
                                    || s.FieldName.StartsWith("Pricing")
                                    || s.FieldName == "ucjbAmount"
                                    || s.FieldName == "FuelSurchargeAmount"
                                    || s.FieldName == "ucjbVoid"))))
            .Select(s => new PricingChangeRow
            {
                JobId = s.JobId,
                ChangeType = s.ChangeType ?? string.Empty,
                FieldName = s.FieldName!,
                OldValue = s.OldValue,
                NewValue = s.NewValue,
                AtUtc = s.UpdatedAt,
                UpdatedByType = s.UpdatedByType ?? string.Empty,
                StaffFirstName = s.Staff != null ? s.Staff.UcstFirstName : null,
                StaffLastName = s.Staff != null ? s.Staff.UcstLastName : null
            })
            .TagWith("PriceDetail - Live Pricing History").ToListAsync(ct));
        liveHistory = liveHistory.OrderBy(h => h.AtUtc).ToList();

        // Archive journey has no Staff nav - fetch names via one batched lookup.
        var archiveHistoryRaw = await InIdChunksAsync(archiveIds, chunk => jjCtx.JobDeliveryJourneyArchives
            .Where(s => chunk.Contains(s.JobId)
                        && (s.ChangeType == nameof(DeliveryJourneyChangeType.JobCreated)
                            || (s.ChangeType == nameof(DeliveryJourneyChangeType.JobUpdate)
                                && s.FieldName != null
                                && (s.FieldName == "PricingBreakdown"
                                    || s.FieldName.StartsWith("Pricing")
                                    || s.FieldName == "ucjbAmount"
                                    || s.FieldName == "FuelSurchargeAmount"
                                    || s.FieldName == "ucjbVoid"))))
            .Select(s => new
            {
                s.JobId, s.ChangeType, s.FieldName, s.OldValue, s.NewValue, s.UpdatedAt, s.UpdatedByType, s.StaffId
            })
            .TagWith("PriceDetail - Archive Pricing History").ToListAsync(ct));
        archiveHistoryRaw = archiveHistoryRaw.OrderBy(x => x.UpdatedAt).ToList();

        var staffIds = archiveHistoryRaw.Where(x => x.StaffId.HasValue).Select(x => x.StaffId!.Value).Distinct()
            .ToList();
        var staffRaw = await InIdChunksAsync(staffIds, chunk => jjCtx.TucStaffs
            .Where(s => chunk.Contains(s.UcstId))
            .Select(s => new { s.UcstId, s.UcstFirstName, s.UcstLastName })
            .ToListAsync(ct));
        var staffNames = staffRaw.ToDictionary(s => s.UcstId,
            s => (First: (string?)s.UcstFirstName, Last: (string?)s.UcstLastName));

        var archiveHistory = archiveHistoryRaw.Select(x => new PricingChangeRow
        {
            JobId = x.JobId,
            ChangeType = x.ChangeType ?? string.Empty,
            FieldName = x.FieldName!,
            OldValue = x.OldValue,
            NewValue = x.NewValue,
            AtUtc = x.UpdatedAt,
            UpdatedByType = x.UpdatedByType ?? string.Empty,
            StaffFirstName = x.StaffId is { } sid && staffNames.TryGetValue(sid, out var n) ? n.First : null,
            StaffLastName = x.StaffId is { } sid2 && staffNames.TryGetValue(sid2, out var n2) ? n2.Last : null
        }).ToList();

        // ---- Merge (live precedence when a job appears in both) -----------------------------

        var headers = MergePreferLive(liveHeaders, archiveHeaders, h => h.JobId);
        var lines = MergePreferLive(liveLines, archiveLines, l => l.JobId);
        var history = MergePreferLive(liveHistory, archiveHistory, h => h.JobId);

        // ---- Split legs: surface each leg's own attributed lines ----------------------------

        lines = WithSplitLegLines(lines);

        // ---- Split-child fallback: children with no own lines inherit parent lines ---------
        // Only reached by splits made before per-leg lines existed — a leg with attributed rows is
        // already in jobsWithLines below. Mirrors GetJobPriceBreakdownAsync's legacy fallback.

        var jobsWithLines = lines.Select(l => l.JobId).ToHashSet();
        var childrenNeedingParent = headers
            .Where(h => !jobsWithLines.Contains(h.JobId) && h.BookingParentId is not null)
            .ToList();
        if (childrenNeedingParent.Count > 0)
        {
            var parentIds = childrenNeedingParent.Select(h => h.BookingParentId!.Value).Distinct().ToList();
            var parentLiveLines = await InIdChunksAsync(parentIds, chunk => pbCtx.PricingBreakdowns
                .Where(p => p.JobId != null && chunk.Contains(p.JobId.Value))
                .Select(p => new PriceDetailLineRow
                {
                    JobId = p.JobId!.Value, ChargeName = p.ChargeName ?? string.Empty, ChargeAmount = p.ChargeAmount,
                    CourierPay = p.CostAmount
                })
                .TagWith("PriceDetail - Split-child Parent Lines (Live)").ToListAsync(ct));
            var parentArchiveLines = await InIdChunksAsync(parentIds, chunk => pbCtx.PricingBreakdownArchives
                .Where(p => p.JobId != null && chunk.Contains(p.JobId.Value))
                .Select(p => new PriceDetailLineRow
                {
                    JobId = p.JobId!.Value, ChargeName = p.ChargeName ?? string.Empty, ChargeAmount = p.ChargeAmount,
                    CourierPay = p.CostAmount
                })
                .TagWith("PriceDetail - Split-child Parent Lines (Archive)").ToListAsync(ct));
            var parentLinesByJob = parentLiveLines.Concat(parentArchiveLines)
                .GroupBy(pl => pl.JobId).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var child in childrenNeedingParent)
            {
                if (!parentLinesByJob.TryGetValue(child.BookingParentId!.Value, out var pls)) continue;
                lines.AddRange(pls.Select(pl => new PriceDetailLineRow
                {
                    JobId = child.JobId,
                    ChargeName = pl.ChargeName,
                    ChargeAmount = pl.ChargeAmount,
                    CourierPay = pl.CourierPay
                }));
            }
        }

        return new PriceDetailReportRaw { Headers = headers, CurrentLines = lines, History = history };
    }

    // A split leg's lines are stored on the parent with ChildJobId pointing at the leg, so they also
    // need to appear under the leg. The parent keeps the whole set (it is the invoice-level total);
    // each leg then reports only its own share instead of inheriting the parent's whole breakdown,
    // which is what made both parts of KT1314V show the parent's full revenue and cost.
    // internal so DespatchWeb.Tests can exercise it directly (InternalsVisibleTo is set).
    internal static List<PriceDetailLineRow> WithSplitLegLines(List<PriceDetailLineRow> lines)
    {
        var legLines = lines
            .Where(l => l.ChildJobId is { } childId && childId != l.JobId)
            .Select(l => new PriceDetailLineRow
            {
                JobId = l.ChildJobId!.Value,
                ChildJobId = l.ChildJobId,
                ChargeName = l.ChargeName,
                ChargeAmount = l.ChargeAmount,
                CourierPay = l.CourierPay
            })
            .ToList();

        if (legLines.Count == 0)
        {
            return lines;
        }

        var merged = new List<PriceDetailLineRow>(lines.Count + legLines.Count);
        merged.AddRange(lines);
        merged.AddRange(legLines);
        return merged;
    }

    // Prefer live rows; append archive rows only for job ids not present in the live set.
    // internal so DespatchWeb.Tests can exercise it directly (InternalsVisibleTo is set).
    internal static List<T> MergePreferLive<T>(List<T> live, List<T> archive, Func<T, int> jobIdOf)
    {
        var liveJobIds = live.Select(jobIdOf).ToHashSet();
        var merged = new List<T>(live);
        merged.AddRange(archive.Where(a => !liveJobIds.Contains(jobIdOf(a))));
        return merged;
    }

    // "3 HU, 20x30x40, 100 lb" per item. Zero-dim items still render (weight is meaningful alone).
    private static string FormatDim(int hu, double? l, double? d, double? h, double w)
    {
        var lwh = (l.HasValue && d.HasValue && h.HasValue && (l > 0 || d > 0 || h > 0))
            ? $", {l:0.##}x{d:0.##}x{h:0.##}"
            : string.Empty;
        return $"{hu} HU{lwh}, {w:0.##} lb";
    }

    // Chunks a Contains(...) list into 2000-id slices to stay under SQL Server's ~2100 parameter
    // limit. queryFn is invoked per chunk; results are concatenated. No-op on empty input.
    internal static async Task<List<T>> InIdChunksAsync<T>(
        IReadOnlyList<int> ids, Func<IReadOnlyList<int>, Task<List<T>>> queryFn)
    {
        if (ids.Count == 0) return new List<T>();
        if (ids.Count <= PriceDetailInChunkSize) return await queryFn(ids);
        var result = new List<T>(ids.Count);
        for (var i = 0; i < ids.Count; i += PriceDetailInChunkSize)
        {
            var take = Math.Min(PriceDetailInChunkSize, ids.Count - i);
            var slice = new List<int>(take);
            for (var k = 0; k < take; k++) slice.Add(ids[i + k]);
            result.AddRange(await queryFn(slice));
        }

        return result;
    }
}