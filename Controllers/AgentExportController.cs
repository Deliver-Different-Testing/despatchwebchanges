#nullable enable
using DeliverDifferent.AgentAccess.Export;
using DespatchWeb.EntityClasses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Controllers;

[ApiController]
[Authorize(Policy = AgentExport.Policy)]
public class AgentExportController(IEntityExportService export, IDbContextFactory<DespatchContext> contextFactory) : ControllerBase
{
    private static readonly string[] Entities =
    [
        "jobs", "jobs_archive", "pricing_breakdown", "pricing_breakdown_archive", "job_events",
        "delivery_journey", "delivery_journey_archive"
    ];

    [HttpGet("/Agent/Export/{entity}")]
    public IResult Get(string entity, string? cursor, int? pageSize, DateOnly? since, DateOnly? until)
    {
        if (!Entities.Contains(entity, StringComparer.OrdinalIgnoreCase))
        {
            return Results.NotFound(new { error = $"Unknown entity '{entity}'.", entities = Entities });
        }

        // The IResult runs after this action returns, so the context lives until the response has been written.
        var db = contextFactory.CreateDbContext();
        HttpContext.Response.RegisterForDispose(db);
        var request = new ExportRequest(cursor, pageSize, since, until);

        return entity.ToLowerInvariant() switch
        {
            "jobs" => export.Export(db, new ExportSpec<TucJob>("jobs", w => LiveJobs(db, w), nameof(TucJob.UcjbId),
                nameof(TucJob.UcjbDate), WindowRequired: true), request),
            "jobs_archive" => export.Export(db, new ExportSpec<TucJobArchive>("jobs_archive", w => ArchivedJobs(db, w),
                nameof(TucJobArchive.UcjbId), nameof(TucJobArchive.UcjbDate), WindowRequired: true), request),
            "pricing_breakdown" => export.Export(db, new ExportSpec<PricingBreakdown>("pricing_breakdown",
                w => db.PricingBreakdowns.Where(p => p.JobId != null && LiveJobIds(db, w).Contains(p.JobId.Value)),
                nameof(PricingBreakdown.PricingBreakdownId), WindowRequired: true), request),
            "pricing_breakdown_archive" => export.Export(db, new ExportSpec<PricingBreakdownArchive>("pricing_breakdown_archive",
                w => db.PricingBreakdownArchives.Where(p => p.JobId != null && ArchivedJobIds(db, w).Contains(p.JobId.Value)),
                nameof(PricingBreakdownArchive.PricingBreakdownId), WindowRequired: true), request),
            "job_events" => export.Export(db, new ExportSpec<TucEvent>("job_events",
                w => db.TucEvents.Where(e => e.UcevJobId != null
                    && (LiveJobIds(db, w).Contains(e.UcevJobId.Value) || ArchivedJobIds(db, w).Contains(e.UcevJobId.Value))),
                nameof(TucEvent.UcevId), WindowRequired: true), request),
            "delivery_journey" => export.Export(db, new ExportSpec<JobDeliveryJourney>("delivery_journey",
                w => db.JobDeliveryJourneys.Where(j => LiveJobIds(db, w).Contains(j.JobId)),
                nameof(JobDeliveryJourney.JourneyId), WindowRequired: true), request),
            _ => export.Export(db, new ExportSpec<JobDeliveryJourneyArchive>("delivery_journey_archive",
                w => db.JobDeliveryJourneyArchives.Where(j => ArchivedJobIds(db, w).Contains(j.JobId)),
                nameof(JobDeliveryJourneyArchive.JourneyId), WindowRequired: true), request)
        };
    }

    private static IQueryable<TucJob> LiveJobs(DespatchContext db, ExportWindow? w) =>
        db.TucJobs.Where(j => j.UcjbDate >= w!.From && j.UcjbDate < w.ToExclusive);

    // Live wins, as JobRepository.ExcludeLiveDuplicates.
    private static IQueryable<TucJobArchive> ArchivedJobs(DespatchContext db, ExportWindow? w) =>
        db.TucJobArchives.Where(a => a.UcjbDate != null && a.UcjbDate >= w!.From && a.UcjbDate < w.ToExclusive
            && !db.TucJobs.Any(l => l.UcjbId == a.UcjbId));

    private static IQueryable<int> LiveJobIds(DespatchContext db, ExportWindow? w) => LiveJobs(db, w).Select(j => j.UcjbId);

    private static IQueryable<int> ArchivedJobIds(DespatchContext db, ExportWindow? w) => ArchivedJobs(db, w).Select(a => a.UcjbId);
}
