using System.Text.RegularExpressions;
using DeliverDifferent.AlertLabel.Data.Models;
using DeliverDifferent.AlertLabel.Data.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed partial class JobLabelService(
    IDbContextFactory<DespatchContext> contextFactory,
    IAlertLabelService alertLabels,
    ITenantClock clock) : IJobLabelService
{
    // AlertLabel modes: 2 = bulk job, 7 = job dated from its parent, 9 = leg dated from the leg itself.
    private const int BulkMode = 2;
    private const int JobMode = 7;
    private const int LegMode = 9;

    public async Task<JobLabel?> GetLabelAsync(int jobId, bool isBulk, CancellationToken ct = default)
    {
        await using var context = await contextFactory.CreateDbContextAsync(ct);
        return isBulk ? await BulkLabelAsync(context, jobId, ct) : await JobLabelAsync(context, jobId, ct);
    }

    private async Task<JobLabel?> JobLabelAsync(DespatchContext context, int jobId, CancellationToken ct)
    {
        // Every lookup goes through the EF scope filters: the renderer reads the DB directly and bypasses them.
        var job = await Jobs(context).FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (job is null) return null;

        var delNumber = DeliveryLegNumber(job.Number, job.ParentId is not null, job.RelationshipTypeId);
        var target = delNumber is null || delNumber.Equals(job.Number, StringComparison.OrdinalIgnoreCase)
            ? job
            : await Jobs(context).FirstOrDefaultAsync(j => j.Number == delNumber && j.ClientId == job.ClientId
                && (j.RelationshipTypeId == FlightLeg || j.RelationshipTypeId == LinehaulLeg), ct)
              ?? throw new JobLabelException($"The delivery leg {delNumber} wasn't found, so its label can't be printed yet.");

        // The renderer skips void jobs and would fail with an unexplained error.
        if (target.Void)
            throw new JobLabelException("This job is void, so it has no label to print.");

        // Only the leg we print matters: a DEL leg we deliver ourselves gets our label even if the trunk went by carrier.
        if (!string.IsNullOrWhiteSpace(target.CarrierConnote))
            throw new JobLabelException("This job's label comes from the courier network, so it can't be printed here.");

        var templateId = await SpeedLabelIdAsync(context, target.Speed, ct)
            ?? await context.TblSettings.Select(s => s.DefaultJobLabelId > 0 ? s.DefaultJobLabelId : null).FirstOrDefaultAsync(ct)
            ?? throw new JobLabelException("No label template is set up for this service level or as the default job label.");

        var pdf = await alertLabels.GeneratePdfAsync(new AlertLabelRequest
        {
            ConnectionString = context.Database.GetConnectionString()!,
            TemplateId = templateId,
            // A bulk child's parent is a tblBulkJob, which the parent-dated mode can't join to.
            Mode = (delNumber is not null && target.ParentId is not null) || target.RelationshipTypeId == LinehaulLeg
                ? LegMode
                : JobMode,
            JobId = target.Id,
        });
        return new JobLabel(pdf, $"Label-{(string.IsNullOrWhiteSpace(target.Number) ? target.Id.ToString() : target.Number)}.pdf");
    }

    private async Task<JobLabel?> BulkLabelAsync(DespatchContext context, int bulkJobId, CancellationToken ct)
    {
        var bulkJob = await context.TblBulkJobs
            .Where(b => b.BulkJobId == bulkJobId)
            .Select(b => new { b.JobNumber, b.Speed, b.Void, b.BookDate })
            .FirstOrDefaultAsync(ct);
        if (bulkJob is null) return null;

        // The renderer's bulk mode only reads live bookings from the last year and would fail with an unexplained error.
        if (bulkJob.Void)
            throw new JobLabelException("This booking is void, so it has no label to print.");
        // The renderer checks against the DB server's (NZ) clock, so this can disagree by up to a day at the boundary.
        if (bulkJob.BookDate <= clock.TenantNow.AddYears(-1))
            throw new JobLabelException("This booking is more than a year old, so its label can't be printed.");

        var templateId = await SpeedLabelIdAsync(context, bulkJob.Speed, ct)
            ?? await context.TblSettings.Select(s => s.DefaultBulkLabelId > 0 ? s.DefaultBulkLabelId : null).FirstOrDefaultAsync(ct)
            ?? throw new JobLabelException("No label template is set up for this service level or as the default bulk label.");

        var pdf = await alertLabels.GeneratePdfAsync(new AlertLabelRequest
        {
            ConnectionString = context.Database.GetConnectionString()!,
            TemplateId = templateId,
            Mode = BulkMode,
            JobId = bulkJobId,
        });
        return new JobLabel(pdf, $"Label-{(string.IsNullOrWhiteSpace(bulkJob.JobNumber) ? bulkJobId.ToString() : bulkJob.JobNumber)}.pdf");
    }

    private static Task<int?> SpeedLabelIdAsync(DespatchContext context, int? speedId, CancellationToken ct) =>
        speedId is null or 0
            ? Task.FromResult<int?>(null)
            : context.TucJobTypes.Where(t => t.UcjtId == speedId).Select(t => t.LabelId > 0 ? t.LabelId : null).FirstOrDefaultAsync(ct);

    private const int FlightParent = (int)JobRelationshipTypes.MedicalRun;
    private const int FlightLeg = (int)JobRelationshipTypes.MedicalRunSingle;
    private const int LinehaulLeg = (int)JobRelationshipTypes.BulkChild;

    /// <summary>
    /// The job number of the delivery leg in a linehaul (LHP / LHn / DEL) or flight (DF1-3) family,
    /// or null when the job isn't part of one. The number suffix alone isn't trusted: a leg must also
    /// carry a leg relationship type, so a split or return child that happens to end in "DEL" isn't one.
    /// </summary>
    internal static string? DeliveryLegNumber(string? number, bool hasParent, int? relationshipTypeId)
    {
        if (string.IsNullOrEmpty(number)) return null;
        if (!hasParent)
            return relationshipTypeId == FlightParent && number.EndsWith("DF", StringComparison.OrdinalIgnoreCase) ? number + "3" : null;
        if (relationshipTypeId is not (FlightLeg or LinehaulLeg)) return null;

        var linehaul = LinehaulLegSuffix().Match(number);
        if (linehaul.Success) return number[..linehaul.Index] + "DEL";

        var flight = FlightLegSuffix().Match(number);
        if (flight.Success) return number[..flight.Index] + "DF3";

        return null;
    }

    [GeneratedRegex("(LHP|LH[0-9]+|DEL)$", RegexOptions.IgnoreCase)]
    private static partial Regex LinehaulLegSuffix();

    [GeneratedRegex("DF[123]$", RegexOptions.IgnoreCase)]
    private static partial Regex FlightLegSuffix();

    private static IQueryable<LabelJob> Jobs(DespatchContext context) =>
        context.TucJobs.Select(j => new LabelJob
        {
            Id = j.UcjbId, Number = j.UcjbNumber, ParentId = j.ParentId, ClientId = j.UcjbClientId,
            Speed = j.UcjbSpeed, CarrierConnote = j.Gssconnote, RelationshipTypeId = j.JobRelationshipTypeId,
            Void = j.UcjbVoid,
        }).Concat(context.TucJobArchives.Select(j => new LabelJob
        {
            Id = j.UcjbId, Number = j.UcjbNumber, ParentId = j.ParentId, ClientId = j.UcjbClientId,
            Speed = j.UcjbSpeed, CarrierConnote = j.Gssconnote, RelationshipTypeId = j.JobRelationshipTypeId,
            Void = j.UcjbVoid,
        }));

    private sealed class LabelJob
    {
        public int Id { get; init; }
        public string? Number { get; init; }
        public int? ParentId { get; init; }
        public int? RelationshipTypeId { get; init; }
        public int? ClientId { get; init; }
        public int? Speed { get; init; }
        public string? CarrierConnote { get; init; }
        public bool Void { get; init; }
    }
}
