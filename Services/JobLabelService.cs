using System.Text.RegularExpressions;
using DeliverDifferent.AlertLabel.Data.Models;
using DeliverDifferent.AlertLabel.Data.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed partial class JobLabelService(
    IDbContextFactory<DespatchContext> contextFactory,
    IAlertLabelService alertLabels) : IJobLabelService
{
    // AlertLabel modes: 2 = bulk job, 7 = job dated from its parent, 9 = leg dated from the leg itself.
    private const int BulkMode = 2;
    private const int JobMode = 7;
    private const int LegMode = 9;

    public async Task<JobLabel?> GetLabelAsync(int jobId, bool isBulk)
    {
        await using var context = await contextFactory.CreateDbContextAsync();
        return isBulk ? await BulkLabelAsync(context, jobId) : await JobLabelAsync(context, jobId);
    }

    private async Task<JobLabel?> JobLabelAsync(DespatchContext context, int jobId)
    {
        // Every lookup goes through the EF scope filters: the renderer reads the DB directly and bypasses them.
        var job = await Jobs(context).FirstOrDefaultAsync(j => j.Id == jobId);
        if (job is null) return null;

        var delNumber = DeliveryLegNumber(job.Number, job.ParentId is not null);
        var target = delNumber is null || delNumber.Equals(job.Number, StringComparison.OrdinalIgnoreCase)
            ? job
            : await Jobs(context).FirstOrDefaultAsync(j => j.Number == delNumber && j.ClientId == job.ClientId) ?? job;

        if (!string.IsNullOrWhiteSpace(job.CarrierConnote) || !string.IsNullOrWhiteSpace(target.CarrierConnote))
            throw new JobLabelException("This job's label comes from the courier network, so it can't be printed here.");

        var settings = await context.TblSettings.Select(s => new { s.DefaultJobLabelId }).FirstOrDefaultAsync();
        var templateId = await SpeedLabelIdAsync(context, target.Speed) ?? settings?.DefaultJobLabelId
            ?? throw new JobLabelException("No label template is set up for this service level or as the default job label.");

        var pdf = await alertLabels.GeneratePdfAsync(new AlertLabelRequest
        {
            ConnectionString = context.Database.GetConnectionString()!,
            TemplateId = templateId,
            Mode = delNumber is null ? JobMode : LegMode,
            JobId = target.Id,
        });
        return new JobLabel(pdf, $"Label-{target.Number}.pdf");
    }

    private async Task<JobLabel?> BulkLabelAsync(DespatchContext context, int bulkJobId)
    {
        var bulkJob = await context.TblBulkJobs
            .Where(b => b.BulkJobId == bulkJobId)
            .Select(b => new { b.JobNumber, b.Speed })
            .FirstOrDefaultAsync();
        if (bulkJob is null) return null;

        var settings = await context.TblSettings.Select(s => new { s.DefaultBulkLabelId }).FirstOrDefaultAsync();
        var templateId = await SpeedLabelIdAsync(context, bulkJob.Speed) ?? settings?.DefaultBulkLabelId
            ?? throw new JobLabelException("No label template is set up for this service level or as the default bulk label.");

        var pdf = await alertLabels.GeneratePdfAsync(new AlertLabelRequest
        {
            ConnectionString = context.Database.GetConnectionString()!,
            TemplateId = templateId,
            Mode = BulkMode,
            JobId = bulkJobId,
        });
        return new JobLabel(pdf, $"Label-{bulkJob.JobNumber}.pdf");
    }

    private static Task<int?> SpeedLabelIdAsync(DespatchContext context, int? speedId) =>
        speedId is null or 0
            ? Task.FromResult<int?>(null)
            : context.TucJobTypes.Where(t => t.UcjtId == speedId).Select(t => t.LabelId).FirstOrDefaultAsync();

    /// <summary>
    /// The job number of the delivery leg in a linehaul (LHP / LHn / DEL) or flight (DF1-3) family,
    /// or null when the job isn't part of one.
    /// </summary>
    internal static string? DeliveryLegNumber(string? number, bool hasParent)
    {
        if (string.IsNullOrEmpty(number)) return null;

        var linehaul = LinehaulLegSuffix().Match(number);
        if (linehaul.Success) return number[..linehaul.Index] + "DEL";

        var flight = FlightLegSuffix().Match(number);
        if (flight.Success) return number[..flight.Index] + "DF3";

        return !hasParent && number.EndsWith("DF", StringComparison.OrdinalIgnoreCase) ? number + "3" : null;
    }

    [GeneratedRegex("(LHP|LH[0-9]+|DEL)$", RegexOptions.IgnoreCase)]
    private static partial Regex LinehaulLegSuffix();

    [GeneratedRegex("DF[123]$", RegexOptions.IgnoreCase)]
    private static partial Regex FlightLegSuffix();

    private static IQueryable<LabelJob> Jobs(DespatchContext context) =>
        context.TucJobs.Select(j => new LabelJob
        {
            Id = j.UcjbId, Number = j.UcjbNumber, ParentId = j.ParentId, ClientId = j.UcjbClientId,
            Speed = j.UcjbSpeed, CarrierConnote = j.Gssconnote,
        }).Concat(context.TucJobArchives.Select(j => new LabelJob
        {
            Id = j.UcjbId, Number = j.UcjbNumber, ParentId = j.ParentId, ClientId = j.UcjbClientId,
            Speed = j.UcjbSpeed, CarrierConnote = j.Gssconnote,
        }));

    private sealed class LabelJob
    {
        public int Id { get; init; }
        public string Number { get; init; } = "";
        public int? ParentId { get; init; }
        public int? ClientId { get; init; }
        public int? Speed { get; init; }
        public string? CarrierConnote { get; init; }
    }
}
