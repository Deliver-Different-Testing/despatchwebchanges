#nullable enable
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Reads the minimum-hourly-top-up standing straight from the tables Accounts and the nightly procs own
/// (<c>CourierDailyHours</c>, <c>tucCourier.TopUp*</c>, <c>tblSetting.TopUp*</c>) with raw SQL, so the pay fields never
/// become properties on this app's <c>TucCourier</c>. Pay rates and minimum hours are used inside the query and never
/// returned.
/// </summary>
public sealed class DriverTopUpStatusService(
    IDbContextFactory<DespatchContext> contextFactory,
    IAccessKeyService accessKeys,
    ITenantInfoService infoService,
    IMemoryCache cache) : IDriverTopUpStatusService
{
    public async Task<IReadOnlyList<DriverTopUpStatus>> GetStatusesAsync()
    {
        try
        {
            if (!await accessKeys.HasAsync(DashboardFeatureKeys.DriverEarningsStatus))
            {
                return [];
            }

            // The behind figure is nightly and the minimum alert is minute-level: a minute of cache is invisible and
            // takes the query off every dispatch-board refresh.
            var cacheKey = $"{infoService.GetCurrentTenantId()}:topup-status";
            return await cache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60);
                return await QueryAsync();
            }) ?? [];
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Driver top-up status could not be read");
            return [];
        }
    }

    private async Task<IReadOnlyList<DriverTopUpStatus>> QueryAsync()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        // Composable single SELECT (no DECLARE batch). Period = the one containing today, from the anchor date;
        // hours are through yesterday because the table is built nightly. MinimumEndsAt = today's first pickup plus the
        // driver's minimum hours, only while the alert is switched on.
        var rows = await ctx.Database.SqlQuery<StatusRow>($@"
            SELECT c.uccrId AS CourierId,
                   c.uccrName + ' ' + c.uccrSurname AS Name,
                   c.Code AS Code,
                   ISNULL(agg.DaysWorked, 0) AS DaysWorked,
                   ISNULL(agg.Deliveries, 0) AS Deliveries,
                   ISNULL(agg.PaidHours, 0) AS PaidHours,
                   CASE WHEN ISNULL(agg.Owed, 0) - ISNULL(agg.Earned, 0) > 0
                        THEN ISNULL(agg.Owed, 0) - ISNULL(agg.Earned, 0) ELSE 0 END AS BehindBy,
                   CASE WHEN s.AlertMinutes IS NULL OR c.TopUpMinimumHours IS NULL THEN NULL
                        ELSE DATEADD(MINUTE, CAST(c.TopUpMinimumHours * 60 AS int), fp.FirstPickup) END AS MinimumEndsAt,
                   s.AlertMinutes AS MinimumAlertMinutes,
                   s.ShowHours AS ShowHours
            FROM dbo.tucCourier c
            CROSS APPLY (SELECT TOP 1 TopUpPeriodAnchorDate AS Anchor, TopUpPeriodDays AS Days,
                                      TopUpMinimumAlertMinutes AS AlertMinutes, TopUpDispatchShowsHours AS ShowHours
                         FROM dbo.tblSetting) s
            CROSS APPLY (SELECT CAST(dbo.UTL_GetTenantLocalDateTime() AS date) AS Today) t
            CROSS APPLY (SELECT CASE WHEN s.Anchor IS NULL OR t.Today < s.Anchor THEN NULL
                                     ELSE DATEADD(DAY, (DATEDIFF(DAY, s.Anchor, t.Today) / s.Days) * s.Days, s.Anchor) END AS PeriodStart) p
            OUTER APPLY (SELECT SUM(h.PaidHours * h.HourlyRate) AS Owed,
                                SUM(h.JobEarnings) AS Earned,
                                SUM(h.PaidHours) AS PaidHours,
                                SUM(CASE WHEN h.JobCount > 0 THEN 1 ELSE 0 END) AS DaysWorked,
                                SUM(h.JobCount) AS Deliveries
                         FROM dbo.CourierDailyHours h
                         WHERE p.PeriodStart IS NOT NULL AND h.CourierId = c.uccrId
                           AND h.WorkDate >= p.PeriodStart AND h.WorkDate < t.Today) agg
            OUTER APPLY (SELECT MIN(j.PickUpTime) AS FirstPickup
                         FROM dbo.tblJob j
                         WHERE s.AlertMinutes IS NOT NULL AND j.CourierID = c.uccrId
                           AND ISNULL(j.[Void], 0) = 0
                           AND j.PickUpTime >= t.Today AND j.PickUpTime < DATEADD(DAY, 1, t.Today)) fp
            WHERE c.TopUpEligible = 1 AND c.Active = 1").ToListAsync();

        return rows.Select(r => new DriverTopUpStatus
        {
            CourierId = r.CourierId,
            Name = r.Name,
            Code = r.Code,
            DaysWorked = r.DaysWorked,
            Deliveries = r.Deliveries,
            PaidHours = r.PaidHours,
            BehindBy = Math.Round(r.BehindBy, 2),
            MinimumEndsAt = r.MinimumEndsAt,
            MinimumAlertMinutes = r.MinimumAlertMinutes,
            ShowHours = r.ShowHours,
        }).ToList();
    }

    private sealed class StatusRow
    {
        public int CourierId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public int DaysWorked { get; set; }
        public int Deliveries { get; set; }
        public decimal PaidHours { get; set; }
        public decimal BehindBy { get; set; }
        public DateTime? MinimumEndsAt { get; set; }
        public int? MinimumAlertMinutes { get; set; }
        public bool ShowHours { get; set; }
    }
}
