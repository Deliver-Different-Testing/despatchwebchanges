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
    ILabelTemplateResolver templates,
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
        // Job lookups go through the EF scope filters: the renderer (and the template function) read the DB directly and bypass them.
        var job = await Jobs(context).FirstOrDefaultAsync(j => j.Id == jobId, ct);
        if (job is null) return null;

        var delNumber = DeliveryLegNumber(job.Number, job.ParentId is not null, job.RelationshipTypeId);
        var target = delNumber is null || delNumber.Equals(job.Number, StringComparison.OrdinalIgnoreCase)
            ? job
            : await Jobs(context).FirstOrDefaultAsync(j => j.Number == delNumber && j.ClientId == job.ClientId
                && (j.RelationshipTypeId == FlightLeg || j.RelationshipTypeId == LinehaulLeg), ct)
              ?? throw new JobLabelException($"The delivery leg {delNumber} wasn't found, or you don't have access to it, so its label can't be printed.");

        // The renderer skips void jobs and would fail with an unexplained error.
        if (target.Void)
            throw new JobLabelException(target == job
                ? "This job is void, so it has no label to print."
                : $"The delivery leg {target.Number} is void, so it has no label to print.");

        // Only the leg we print matters: a DEL leg we deliver ourselves gets our label even if the trunk went by carrier.
        if (!string.IsNullOrWhiteSpace(target.CarrierConnote))
            throw new JobLabelException("This job's label comes from the courier network, so it can't be printed here.");

        var templateId = await templates.ResolveAsync(context, target.ClientId, target.Speed, isBulk: false, ct) is > 0 and var id
            ? id
            : throw new JobLabelException("No label template is set up for this client, its service level or as the default job label.");

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
        return Label(pdf, target.Number, target.Id);
    }

    private async Task<JobLabel?> BulkLabelAsync(DespatchContext context, int bulkJobId, CancellationToken ct)
    {
        var bulkJob = await context.TblBulkJobs
            .Where(b => b.BulkJobId == bulkJobId)
            .Select(b => new { b.JobNumber, b.ClientId, b.Speed, b.Void, b.BookDate })
            .FirstOrDefaultAsync(ct);
        if (bulkJob is null) return null;

        // The renderer's bulk mode only reads live bookings from the last year and would fail with an unexplained error.
        if (bulkJob.Void)
            throw new JobLabelException("This booking is void, so it has no label to print.");
        // The renderer checks against the DB server's (NZ) clock, so this can disagree by up to a day at the boundary.
        if (bulkJob.BookDate <= clock.TenantNow.AddYears(-1))
            throw new JobLabelException("This booking is more than a year old, so its label can't be printed.");

        var templateId = await templates.ResolveAsync(context, bulkJob.ClientId, bulkJob.Speed, isBulk: true, ct) is > 0 and var id
            ? id
            : throw new JobLabelException("No label template is set up for this client, its service level or as the default bulk label.");

        var pdf = await alertLabels.GeneratePdfAsync(new AlertLabelRequest
        {
            ConnectionString = context.Database.GetConnectionString()!,
            TemplateId = templateId,
            Mode = BulkMode,
            JobId = bulkJobId,
        });
        return Label(pdf, bulkJob.JobNumber, bulkJobId);
    }

    private static JobLabel Label(byte[] pdf, string? number, int id) =>
        new(pdf, $"Label-{(string.IsNullOrWhiteSpace(number) ? id.ToString() : number)}.pdf");

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
