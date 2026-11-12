#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

public sealed record Artifact(
    string Kind,
    string Leg,
    string? Folder,
    string? FileName,
    string? ContentType,
    long? SizeBytes,
    DateTime? TakenAt);

public sealed record EvidenceCounts(int DeliverySignatures, int DeliveryPhotos, int PickupSignatures, int PickupPhotos, int PickupScannedDocuments, int Attachments, int Unclassified);

public interface IAgentJobEvidenceService
{
    Task<JsonObject> GetAsync(string? jobNumber, int? jobId, string? month, bool all, int maxItems, CancellationToken cancellationToken = default);
}

/// <summary>
/// What proof we hold that a job was delivered, from the S3 listing (never the image bytes) and the job record. The month
/// the folders are keyed by comes from completedTime, never from today.
/// </summary>
public sealed partial class AgentJobEvidenceService(IJobQueryRepository jobs, IJobPhotoService photos) : IAgentJobEvidenceService
{
    public const int DefaultMaxItems = 100;
    public const int MaxItems = 1000;

    [GeneratedRegex(@"(^|/)(DeliverySignatures|DeliveryPhotos|DeliveryScannedDocuments|PickupSignatures|PickupPhotos|PickupScannedDocuments)/", RegexOptions.IgnoreCase)]
    private static partial Regex Folder();

    [GeneratedRegex(@"^(\d{4})-(\d{2})$")]
    private static partial Regex YearMonth();

    public static (int Year, int Month)? CompletionMonth(DateTime? completed) =>
        completed is { } c && c.Year >= 1900 ? (c.Year, c.Month) : null;

    /// <summary>The S3 folder is the only honest signal of what an artefact is; a key in none of them is unclassified.</summary>
    public static Artifact Classify(CapturedMediaInfo media)
    {
        var folder = Folder().Match(media.S3Key) is { Success: true } m ? m.Groups[2].Value : null;
        var kind = folder is null ? "unclassified"
            : folder.EndsWith("signatures", StringComparison.OrdinalIgnoreCase) ? "signature"
            : folder.EndsWith("scanneddocuments", StringComparison.OrdinalIgnoreCase) ? "scanned_document"
            : "photo";
        var name = media.S3Key[(media.S3Key.LastIndexOf('/') + 1)..];
        return new Artifact(kind, media.Leg, folder, name, null, media.Size, media.LastModified);
    }

    public static EvidenceCounts Count(IReadOnlyList<Artifact> items)
    {
        int N(Func<Artifact, bool> f) => items.Count(f);
        return new EvidenceCounts(
            N(a => a.Leg == "delivery" && a.Kind == "signature"),
            N(a => a.Leg == "delivery" && a.Kind is "photo" or "scanned_document"),
            N(a => a.Leg == "pickup" && a.Kind == "signature"),
            N(a => a.Leg == "pickup" && a.Kind == "photo"),
            N(a => a.Leg == "pickup" && a.Kind == "scanned_document"),
            N(a => a.Kind == "attachment"),
            N(a => a.Kind == "unclassified"));
    }

    public static (string Verdict, List<string> Flags) Assess(DateTime? completed, string? podName, bool isVoid, EvidenceCounts c, bool photosRead)
    {
        var signatures = c.DeliverySignatures + c.PickupSignatures;
        var captured = signatures + c.DeliveryPhotos + c.PickupPhotos + c.PickupScannedDocuments + c.Unclassified;
        var named = !string.IsNullOrWhiteSpace(podName);
        List<string> flags = [];

        var verdict = isVoid ? "void"
            : completed is null ? "not_completed"
            : named && c.DeliverySignatures > 0 ? "signed_and_captured"
            : named && captured > 0 ? "name_and_photos"
            : named ? "name_only"
            : captured > 0 ? "captured_but_unsigned"
            : "no_proof";

        if (isVoid) flags.Add("VOID — the job is voided; the artefacts below are all that is left of it");
        if (completed is not null && !named) flags.Add("Completed with no POD name — nobody is recorded as having signed for it");
        if (completed is null) flags.Add("No completedTime on the record — there is no completion to hold proof of, and no month to key the S3 lookup by");
        if (verdict == "name_only") flags.Add("POD name only — a typed name in the dispatcher dialog, with no photo or signature image behind it");
        if (verdict == "no_proof") flags.Add("No proof at all: no POD name, no signature, no photo, no attachment");
        if (verdict == "captured_but_unsigned") flags.Add("Images exist but no POD name — someone captured proof and the name was never written");
        if (c.Unclassified > 0) flags.Add($"{c.Unclassified} artefact(s) whose S3 key matches none of the known folders — reported unclassified rather than counted as a signature or photo");
        if (photosRead && c.DeliverySignatures == 0 && c.PickupSignatures > 0) flags.Add("The only signature is on the PICKUP leg — a linehaul handover scrawl is not a delivery signature");
        return (verdict, flags);
    }

    public async Task<JsonObject> GetAsync(string? jobNumber, int? jobId, string? month, bool all, int maxItems, CancellationToken ct = default)
    {
        var id = jobId;
        if (id is null)
        {
            if (string.IsNullOrWhiteSpace(jobNumber)) throw new AgentReadException("Give either job (the job number) or job_id.");
            id = await jobs.GetJobIdByNumberAsync(jobNumber.Trim());
            if (id is null) return NotFound(jobNumber);
        }

        if (month is not null && !YearMonth().IsMatch(month)) throw new AgentReadException("month must be yyyy-mm.");

        JobViewModel? job;
        try
        {
            job = await jobs.GetJobWithoutMarkingReadAsync(id.Value);
        }
        catch (KeyNotFoundException)
        {
            job = null;
        }

        if (job is null) return NotFound(jobNumber ?? id.Value.ToString(CultureInfo.InvariantCulture));

        List<string> warnings = [];
        var completed = job.CompletedTime;
        var derived = CompletionMonth(completed);
        (int Year, int Month)? used = null;
        var source = "none";
        if (month is not null)
        {
            var m = YearMonth().Match(month);
            used = (int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture));
            source = "caller";
            if (derived is { } d && d != used)
            {
                warnings.Add($"month={month} was supplied by the caller and does not match completedTime ({completed:yyyy-MM-ddTHH:mm:ss}); the photo lookups used the caller's month.");
            }
        }
        else if (derived is { } d)
        {
            used = d;
            source = "completedTime";
        }
        else
        {
            warnings.Add("No completedTime on the job and no month argument — the delivery/pickup photo lookups were SKIPPED. They are keyed by the completion month and today's month would return an empty list that reads like 'no photos'.");
        }

        ct.ThrowIfCancellationRequested();
        List<Artifact> items = [];
        if (used is { } u)
        {
            items.AddRange((await photos.ListCapturedMediaAsync(id.Value, u.Year, u.Month)).Select(Classify));
            warnings.Add("The photo listing returns empty both when nothing is held and when the S3 listing failed; an empty list is not proof of no photos.");
        }

        var attachments = await photos.GetAttachedFilesAsync(id.Value);
        items.AddRange(attachments.Select(a => new Artifact("attachment", "job", null, a.FileName, null, a.Size, a.LastModified)));

        var counts = Count(items);
        var (verdict, flags) = Assess(completed, job.PodName, job.ResolvedIsVoid, counts, used is not null);
        var cap = Math.Clamp(maxItems, 1, MaxItems);
        var by = job.AssignedCourier?.Text ?? job.Courier;
        if (all && items.Count > cap) warnings.Add($"max_items={cap}: showing {cap} of {items.Count} artefacts.");
        warnings.Add("Image links are not available from this endpoint: despatch holds no sealed download link, so evidence is metadata only. Without agent-see-pod the POD name, signer and file names are omitted (counts, kinds, legs and times stay). takenAt is the S3 last-modified time; by is the job's assigned driver, not a per-image attribution; gpsPresent is not recorded where it can be listed (null).");

        return new JsonObject
        {
            ["found"] = true,
            ["job"] = new JsonObject
            {
                ["id"] = id,
                ["number"] = job.JobNo,
                ["client"] = job.Client ?? job.ClientName,
                ["status"] = job.StatusName,
                ["void"] = job.ResolvedIsVoid,
                ["completedTime"] = JobStoryComposer.Local(completed),
                ["podName"] = job.PodName
            },
            ["month"] = new JsonObject
            {
                ["year"] = used?.Year,
                ["month"] = used?.Month,
                ["source"] = source,
                ["note"] = source switch
                {
                    "completedTime" => "Derived from completedTime, as the S3 folders require. Today's month would have returned an empty list.",
                    "caller" => "Caller-supplied. Not read off the record — treat the photo counts as scoped to the month you asked for.",
                    _ => "No month: the photo lookups were skipped, so their counts below are 0 because nothing was read."
                }
            },
            ["counts"] = new JsonObject
            {
                ["deliverySignatures"] = counts.DeliverySignatures,
                ["deliveryPhotos"] = counts.DeliveryPhotos,
                ["pickupSignatures"] = counts.PickupSignatures,
                ["pickupPhotos"] = counts.PickupPhotos,
                ["pickupScannedDocuments"] = counts.PickupScannedDocuments,
                ["attachments"] = counts.Attachments,
                ["unclassified"] = counts.Unclassified
            },
            ["verdict"] = verdict,
            ["flags"] = AgentJobSearchService.Strings(flags),
            ["artefactCount"] = items.Count,
            ["artefacts"] = all ? new JsonArray([.. items.Take(cap).Select(a => (JsonNode)new JsonObject
            {
                ["kind"] = a.Kind,
                ["leg"] = a.Leg,
                ["folder"] = a.Folder,
                ["fileName"] = a.FileName,
                ["sizeBytes"] = a.SizeBytes,
                ["takenAt"] = JobStoryComposer.Local(a.TakenAt),
                ["by"] = a.Kind == "attachment" ? null : by,
                ["gpsPresent"] = null
            })]) : null,
            ["warnings"] = AgentJobSearchService.Strings(warnings)
        };
    }

    private static JsonObject NotFound(string? job) => new()
    {
        ["found"] = false,
        ["job"] = job,
        ["note"] = "No job with that number or id. Check the number (and the tenant you are connected to)."
    };
}

