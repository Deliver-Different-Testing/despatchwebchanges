#nullable enable
using DeliverDifferentReporting.Documents;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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
    IJobPhotoService jobPhotoService,
    IEmailSender emailSender
) : IPodReportService
{
    private static bool _questPdfInitialized;
    private static readonly Lock InitLock = new();

    public async Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId)
    {
        EnsureQuestPdfInitialized();

        var tenantId = GetTenantId();
        var branding = await GetBrandingOrDefaultAsync(tenantId);
        var job = await jobRepository.GetSingleJobById(jobId)
                  ?? throw new InvalidOperationException($"Job {jobId} not found");

        var s3Photos = await GetDeliveryPhotosForJobAsync(job, jobId);

        var podData = MapToPodData(job, s3Photos, await GetPodNotesAsync(jobId));
        var document = new PodDocument(podData, branding);

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.pdf");
    }

    public async Task<(byte[] Bytes, string FileName)> GeneratePodSpreadsheetAsync(int jobId)
    {
        var tenantId = GetTenantId();
        var branding = await GetBrandingOrDefaultAsync(tenantId);
        var job = await jobRepository.GetSingleJobById(jobId)
                  ?? throw new InvalidOperationException($"Job {jobId} not found");

        var s3Photos = await GetDeliveryPhotosForJobAsync(job, jobId);

        var podData = MapToPodData(job, s3Photos, await GetPodNotesAsync(jobId));
        var spreadsheet = new PodSpreadsheet(podData, branding);

        using var stream = new MemoryStream();
        spreadsheet.Generate(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.xlsx");
    }

    public async Task SendPodEmailAsync(int jobId, List<string> recipients, string subject, string body)
    {
        var (pdfBytes, fileName) = await GeneratePodReportAsync(jobId);

        var replyTo = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                      ?? "support@deliverdifferent.com";

        var htmlBody = body.Replace("\n", "<br>");
        var attachment = new EmailAttachment(fileName, "application/pdf", pdfBytes);

        foreach (var recipient in recipients)
        {
            await emailSender.SendAsync(recipient, subject, htmlBody, replyTo, attachment);
        }

        Log.Information("Sent POD email for job {JobId} to {RecipientCount} recipients: {Recipients}",
            jobId, recipients.Count, string.Join(", ", recipients));
    }

    public async Task<byte[]> AppendDeliveryPhotosAsync(byte[] pdfBytes, int jobId)
    {
        var job = await jobRepository.GetSingleJobById(jobId);
        if (job is null)
        {
            return pdfBytes;
        }

        var s3Photos = await GetDeliveryPhotosForJobAsync(job, jobId);
        return PdfImageAppender.Append(pdfBytes, ExtractDeliveryImages(s3Photos));
    }

    // Delivery photos/signatures live in S3 keyed by the completion month, so they
    // only exist once the job is completed.
    private async Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryPhotosForJobAsync(JobViewModel job, int jobId)
    {
        if (!job.CompletedTime.HasValue)
        {
            return [];
        }

        var year = job.CompletedTime.Value.Year;
        var month = job.CompletedTime.Value.Month;
        return await jobPhotoService.GetDeliveryPhotosAsync(jobId, year, month);
    }

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

        return deliveryPhotos.Concat(signatures)
            .Select(p => Convert.FromBase64String(p.Data))
            .ToList();
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
        return notes?.FirstOrDefault()?.NoteText;
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
        var firstSignature = signaturePhotos.FirstOrDefault(p => !string.IsNullOrEmpty(p.Data));
        var signatureBytes = string.IsNullOrEmpty(firstSignature.Data)
            ? null
            : Convert.FromBase64String(firstSignature.Data);

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

        return parcels.Select(p => new PodItem
        {
            ItemCode = p.ItemId?.ToString(),
            Barcode = p.Barcode,
            Description = p.ItemName
        }).ToList();
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