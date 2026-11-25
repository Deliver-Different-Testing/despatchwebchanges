#nullable enable
using System.Globalization;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Raw SQL against <c>CourierEarlyFinish</c> / <c>CourierEarlyFinishReason</c>, which Accounts reads to show a note on
/// the driver's day. The latest recording for a day counts, so a correction is simply another recording.
/// </summary>
public sealed class DriverEarlyFinishService(
    IDbContextFactory<DespatchContext> contextFactory,
    IAccessKeyService accessKeys,
    ITenantInfoService infoService,
    ITenantClock clock) : IDriverEarlyFinishService
{
    private const int MaxBackDays = 7;
    private const int MaxNoteLength = 200;

    private sealed class ReasonRow
    {
        public byte ReasonId { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public async Task<EarlyFinishOptions> GetOptionsAsync()
    {
        if (!await accessKeys.HasAsync(DashboardFeatureKeys.DriverEarlyFinish))
        {
            return new EarlyFinishOptions { Available = false };
        }

        await using var ctx = await contextFactory.CreateDbContextAsync();
        var reasons = await ReasonsAsync(ctx);
        return new EarlyFinishOptions
        {
            Available = true,
            Reasons = reasons.Select(r => new EarlyFinishReason { Id = r.ReasonId, Name = r.Name }).ToList(),
        };
    }

    public async Task RecordAsync(RecordEarlyFinishRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!await accessKeys.HasAsync(DashboardFeatureKeys.DriverEarlyFinish))
        {
            throw new UnauthorizedAccessException("You do not have access to record a driver early finish.");
        }

        if (!DateTime.TryParseExact(request.FinishTime, "yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var finishTime))
        {
            throw new ArgumentException("Finish time is not valid.");
        }

        var now = clock.TenantNow;
        if (finishTime > now.AddMinutes(5))
        {
            throw new ArgumentException("Finish time cannot be in the future.");
        }

        if (finishTime.Date < now.Date.AddDays(-MaxBackDays))
        {
            throw new ArgumentException($"Finish time cannot be more than {MaxBackDays} days ago.");
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note is { Length: > MaxNoteLength })
        {
            throw new ArgumentException($"Note can be {MaxNoteLength} characters at most.");
        }

        await using var ctx = await contextFactory.CreateDbContextAsync();

        var reasons = await ReasonsAsync(ctx);
        if (reasons.All(r => r.ReasonId != request.ReasonId))
        {
            throw new ArgumentException("Choose a reason.");
        }

        var courierExists = await ctx.TucCouriers.AnyAsync(c => c.UccrId == request.CourierId);
        if (!courierExists)
        {
            throw new ArgumentException("Driver not found.");
        }

        var contactId = infoService.GetContactId();
        var workDate = finishTime.Date;
        await ctx.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO dbo.CourierEarlyFinish (CourierId, WorkDate, ReasonId, FinishTime, Note, CreatedByContactId)
            VALUES ({request.CourierId}, {workDate}, {request.ReasonId}, {finishTime}, {note}, {(contactId > 0 ? contactId : (int?)null)})");
    }

    private static async Task<List<ReasonRow>> ReasonsAsync(DespatchContext ctx) =>
        await ctx.Database.SqlQuery<ReasonRow>($@"
            SELECT ReasonId, Name FROM dbo.CourierEarlyFinishReason ORDER BY SortOrder").ToListAsync();
}
