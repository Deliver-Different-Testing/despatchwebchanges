#nullable enable
using DeliverDifferentReporting.Documents;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.EntityClasses;
using DespatchWeb.Exceptions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using QuestPDF;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using Serilog;

namespace DespatchWeb.Services;

public sealed class PodReportService(
    IHttpContextAccessor httpContextAccessor,
    ITenantBrandingService tenantBrandingService,
    IJobQueryRepository jobRepository,
    INoteRepository noteRepository,
    IPodMediaService podMediaService,
    IDbContextFactory<DespatchContext> contextFactory
) : IPodReportService
{
    private static bool _questPdfInitialized;
    private static readonly Lock InitLock = new();

    public async Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId)
    {
        EnsureQuestPdfInitialized();

        var tenantId = GetTenantId();
        var branding = await GetBrandingOrDefaultAsync(tenantId);
        var (job, mediaJobId) = await ResolveJobAsync(jobId);

        var s3Photos = await GetDeliveryPhotosForJobAsync(job, mediaJobId);

        var podData = MapToPodData(job, s3Photos, await GetPodNotesAsync(mediaJobId));
        var document = new PodDocument(podData, branding);

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.pdf");
    }

    public async Task<(byte[] Bytes, string FileName)> GeneratePodSpreadsheetAsync(int jobId)
    {
        var tenantId = GetTenantId();
        var branding = await GetBrandingOrDefaultAsync(tenantId);
        var (job, mediaJobId) = await ResolveJobAsync(jobId);

        var s3Photos = await GetDeliveryPhotosForJobAsync(job, mediaJobId);

        var podData = MapToPodData(job, s3Photos, await GetPodNotesAsync(mediaJobId));
        var spreadsheet = new PodSpreadsheet(podData, branding);

        using var stream = new MemoryStream();
        spreadsheet.Generate(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.xlsx");
    }

    // Queued to tucManualMessage rather than sent over SMTP from here: the external message
    // processor owns delivery (and the from-address) for every other email in the stack, and it
    // is the only mail path that is actually configured in the deployed environments.
    public async Task SendPodEmailAsync(int jobId, List<string> recipients, string subject, string? body)
    {
        var (pdfBytes, fileName) = await GeneratePodReportAsync(jobId);

        var replyTo = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                      ?? "support@deliverdifferent.com";

        var htmlBody = (body ?? string.Empty).Replace("\n", "<br>");

        var messages = recipients.Select(email => new TucManualMessage
        {
            SendToEmailAddress = email,
            ReplyToEmailAddress = replyTo,
            Subject = subject,
            UcmmMessage = htmlBody,
            JobId = jobId,
            HasAttachment = true,
            FileName = fileName,
            FileType = "application/pdf",
            FileContent = pdfBytes
        }).ToList();

        try
        {
            await using var context = await contextFactory.CreateDbContextAsync();
            await context.TucManualMessages.AddRangeAsync(messages);
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            throw new PodEmailException(
                "The POD report could not be queued for sending. Please try again or contact support.", ex);
        }

        Log.Information("Queued POD email for job {JobId} to {RecipientCount} recipients: {Recipients}",
            jobId, recipients.Count, string.Join(", ", recipients));
    }

    public async Task<byte[]> AppendDeliveryPhotosAsync(byte[] pdfBytes, int jobId)
    {
        var resolved = await TryResolveJobAsync(jobId);
        if (resolved is null)
        {
            return pdfBytes;
        }

        var (job, mediaJobId) = resolved.Value;
        var s3Photos = await GetDeliveryPhotosForJobAsync(job, mediaJobId);
        return PdfImageAppender.Append(pdfBytes, ExtractDeliveryImages(s3Photos));
    }

    private async Task<(JobViewModel Job, int MediaJobId)> ResolveJobAsync(int jobId) =>
        await TryResolveJobAsync(jobId)
        ?? throw new InvalidOperationException($"Job {jobId} not found");

    /// <summary>
    /// Resolves the job the POD is about and the id its media is keyed by. A bulk ("scheduled")
    /// row's id is a tblBulkJob id, not a tucJob id, and the courier writes POD media against the
    /// live job the schedule materialised into — so an id that matches no job is retried as a
    /// schedule id. tucJob first, always: the two id sequences overlap.
    /// </summary>
    private async Task<(JobViewModel Job, int MediaJobId)?> TryResolveJobAsync(int jobId)
    {
        var job = await TryGetJobAsync(jobId);
        if (job is not null)
        {
            return (job, jobId);
        }

        var linkedJobId = await jobRepository.GetLinkedJobIdForBulkJobAsync(jobId);
        if (linkedJobId is null)
        {
            return null;
        }

        var linkedJob = await TryGetJobAsync(linkedJobId.Value);
        return linkedJob is null ? null : (linkedJob, linkedJobId.Value);
    }

    // The archived lookup throws rather than returning null for an id it doesn't know.
    private async Task<JobViewModel?> TryGetJobAsync(int jobId)
    {
        try
        {
            return await jobRepository.GetSingleJobById(jobId);
        }
        catch (KeyNotFoundException)
        {
            return null;
        }
    }

    // Delivery photos/signatures live in S3 keyed by the completion month and by the id of the leg
    // the courier completed — never the parent's. The parent is the number on the POD the client
    // downloads, so the lookup sweeps the family. Its own completion time is only a fallback for a
    // leg that carries none: a family whose parent roll-up never ran still has to render its DEL
    // leg's POD.
    private Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryPhotosForJobAsync(JobViewModel job, int jobId) =>
        podMediaService.GetDeliveryMediaAsync(
            jobId,
            job.CompletedTime?.Year ?? 0,
            job.CompletedTime?.Month ?? 0);

    // Decodes the delivery photos then the signature(s) into raw image bytes.
    // Non-image entries (e.g. PDFs) carry no Data and are skipped.
    internal static List<byte[]> ExtractDeliveryImages(IReadOnlyList<S3PhotoInfo> s3Photos)
    {
        var deliveryPhotos = s3Photos
            .Where(p => p.S3Key.Contains("DeliveryPhotos/", StringComparison.OrdinalIgnoreCase)
                        && !string.IsNullOrEmpty(p.Data));

        var signatures = s3Photos
            .Where(p => p.S3Key.Contains("DeliverySignatures/", StringComparison.OrdinalIgnoreCase)
                        && !string.IsNullOrEmpty(p.Data));

        // Signatures carry the pad's opaque canvas colour (see SignatureBackgroundRemover); key it
        // out so the appended page matches the keyed signature stamped on the overlay itself. A
        // delivery photo's background is real content and is left alone.
        return
        [
            .. deliveryPhotos.Select(p => Convert.FromBase64String(p.Data)),
            .. signatures.Select(p =>
                SignatureBackgroundRemover.RemoveFlatBackground(Convert.FromBase64String(p.Data)))
        ];
    }

    private static void EnsureQuestPdfInitialized()
    {
        lock (InitLock)
            if (_questPdfInitialized)
            {
                return;
            }

        lock (InitLock)
        {
            if (_questPdfInitialized)
            {
                return;
            }

            Settings.License = LicenseType.Community;
            _questPdfInitialized = true;
        }
    }

    // Tenant branding (logo/colours) is cosmetic and fetched from the Hub. A 404 means the
    // tenant simply has no branding configured; a connectivity failure is transient. Neither
    // should block the customer's actual deliverable — the POD — so fall back to default
    // branding (PodDocument/PodSpreadsheet substitute their own theme for empty values).
    private async Task<ReportBranding> GetBrandingOrDefaultAsync(int tenantId)
    {
        try
        {
            return await tenantBrandingService.GetBrandingAsync(tenantId);
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException)
        {
            Log.Warning(ex,
                "No tenant branding available for tenant {TenantId}; falling back to default POD branding",
                tenantId);
            return new ReportBranding { TenantId = tenantId };
        }
    }

    private int GetTenantId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var tenantClaim = user?.Claims.FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value;

        if (string.IsNullOrEmpty(tenantClaim) || !int.TryParse(tenantClaim, out var tenantId))
        {
            throw new InvalidOperationException("Unable to determine tenant ID from user claims");
        }

        return tenantId;
    }

    private async Task<string?> GetPodNotesAsync(int jobId)
    {
        var notes = await noteRepository.GetNotesByJobIdAsync(jobId);
        return notes.Count > 0 ? notes[0].NoteText : null;
    }

    internal static PodData MapToPodData(JobViewModel job, IReadOnlyList<S3PhotoInfo> s3Photos,
        string? podNotes = null)
    {
        // Separate signatures from delivery photos
        var signaturePhotos = s3Photos
            .Where(p => p.S3Key.Contains("DeliverySignatures/", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var deliveryPhotos = s3Photos
            .Where(p => p.S3Key.Contains("DeliveryPhotos/", StringComparison.OrdinalIgnoreCase))
            .ToList();

        // Get signature bytes from the first signature image. S3PhotoInfo is a struct, so
        // FirstOrDefault yields default(S3PhotoInfo) with a null Data when no signature exists —
        // decode only when data is present, otherwise leave the (nullable) signature unset so a
        // POD without a signature still renders instead of throwing.
        // The pad's opaque canvas colour is baked into the stored JPEG, so key it out before the
        // report draws it — otherwise it renders as a grey box around the ink.
        var firstSignature = signaturePhotos.FirstOrDefault(p => !string.IsNullOrEmpty(p.Data));
        var signatureBytes = string.IsNullOrEmpty(firstSignature.Data)
            ? null
            : SignatureBackgroundRemover.RemoveFlatBackground(Convert.FromBase64String(firstSignature.Data));

        return new PodData
        {
            JobNumber = job.JobNo,
            ClientRefA = job.RefA,
            ClientRefB = job.RefB,
            Eta = job.DeliverByTime?.ToString("dd/MM/yyyy HH:mm"),
            DeliveryStatus = job.StatusName ?? "Delivered",
            Account = job.ClientName,
            ServiceType = job.SpeedName,
            GoodsReady = job.CreatedDate,
            PickupName = job.From,
            PickupAddress = job.PickupAddress?.FullAddress,
            DeliveryName = job.ToAddress,
            DeliveryAddress = job.DeliveryAddress?.FullAddress,
            CourierName = job.Courier,
            CourierVehicle = job.Vehicle?.Text,
            CourierId = job.CourierData?.CourierNumber,
            GpsLatitude = job.DeliveryLatitude.HasValue ? (double)job.DeliveryLatitude.Value : null,
            GpsLongitude = job.DeliveryLongitude.HasValue ? (double)job.DeliveryLongitude.Value : null,
            PodName = job.PodName,
            PodDate = job.CompletedTime,
            PodNotes = podNotes,
            SignatureImage = signatureBytes,
            Items = MapItems(job.ParcelDimensions),
            PhotoCategories = MapPhotoCategories(deliveryPhotos)
        };
    }

    internal static List<PodItem> MapItems(List<ParcelDimensions>? parcels)
    {
        if (parcels == null || parcels.Count == 0)
        {
            return [];
        }

        return
        [
            .. parcels.Select(p => new PodItem
            {
                ItemCode = p.ItemId?.ToString(),
                Barcode = p.Barcode,
                Description = p.ItemName
            })
        ];
    }

    internal static List<PhotoCategory> MapPhotoCategories(List<S3PhotoInfo> photos)
    {
        if (photos.Count == 0)
        {
            return [];
        }

        var podPhotos = photos
            .Where(p => !string.IsNullOrEmpty(p.Data))
            .Select(p => new PodPhoto
            {
                ImageBytes = Convert.FromBase64String(p.Data),
                Caption = p.FileName
            })
            .ToList();

        if (podPhotos.Count == 0)
        {
            return [];
        }

        return
        [
            new PhotoCategory
            {
                Category = "Delivery Photos",
                Photos = podPhotos
            }
        ];
    }
}