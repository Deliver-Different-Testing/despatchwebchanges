#nullable enable
using DeliverDifferentReporting.Documents;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.EntityClasses;
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
    IJobRepository jobRepository,
    IJobPhotoService jobPhotoService,
    IDbContextFactory<DespatchContext> contextFactory
) : IPodReportService
{
    private static bool _questPdfInitialized;
    private static readonly Lock InitLock = new();

    public async Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId)
    {
        EnsureQuestPdfInitialized();

        var tenantId = GetTenantId();
        var branding = await tenantBrandingService.GetBrandingAsync(tenantId);
        var job = await jobRepository.GetSingleJobById(jobId)
                  ?? throw new InvalidOperationException($"Job {jobId} not found");

        // Get S3 photos if the job is completed
        IReadOnlyList<S3PhotoInfo> s3Photos = [];
        if (job.CompletedTime.HasValue)
        {
            var year = job.CompletedTime.Value.Year;
            var month = job.CompletedTime.Value.Month;
            s3Photos = await jobPhotoService.GetDeliveryPhotosAsync(jobId, year, month);
        }

        var podData = MapToPodData(job, s3Photos);
        var document = new PodDocument(podData, branding);

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.pdf");
    }

    public async Task<(byte[] Bytes, string FileName)> GeneratePodSpreadsheetAsync(int jobId)
    {
        var tenantId = GetTenantId();
        var branding = await tenantBrandingService.GetBrandingAsync(tenantId);
        var job = await jobRepository.GetSingleJobById(jobId)
                  ?? throw new InvalidOperationException($"Job {jobId} not found");

        IReadOnlyList<S3PhotoInfo> s3Photos = [];
        if (job.CompletedTime.HasValue)
        {
            var year = job.CompletedTime.Value.Year;
            var month = job.CompletedTime.Value.Month;
            s3Photos = await jobPhotoService.GetDeliveryPhotosAsync(jobId, year, month);
        }

        var podData = MapToPodData(job, s3Photos);
        var spreadsheet = new PodSpreadsheet(podData, branding);

        using var stream = new MemoryStream();
        spreadsheet.Generate(stream);

        return (stream.ToArray(), $"POD-{job.JobNo}.xlsx");
    }

    public async Task QueuePodEmailAsync(int jobId, List<string> recipients, string subject, string body)
    {
        var (pdfBytes, fileName) = await GeneratePodReportAsync(jobId);

        var replyTo = Environment.GetEnvironmentVariable("ReplyToEmailAddress")
                      ?? "support@deliverdifferent.com";

        var messages = recipients.Select(email => new TucManualMessage
        {
            SendToEmailAddress = email,
            ReplyToEmailAddress = replyTo,
            Subject = subject,
            UcmmMessage = body.Replace("\n", "<br>"),
            JobId = jobId,
            HasAttachment = true,
            FileName = fileName,
            FileType = "application/pdf",
            FileContent = pdfBytes
        }).ToList();

        await using var context = await contextFactory.CreateDbContextAsync();
        await context.TucManualMessages.AddRangeAsync(messages);
        await context.SaveChangesAsync();

        Log.Information("Queued POD email for job {JobId} to {RecipientCount} recipients: {Recipients}",
            jobId, recipients.Count, string.Join(", ", recipients));
    }

    private static void EnsureQuestPdfInitialized()
    {
        lock (InitLock)
            if (_questPdfInitialized)
                return;

        lock (InitLock)
        {
            if (_questPdfInitialized) return;
            Settings.License = LicenseType.Community;
            _questPdfInitialized = true;
        }
    }

    private int GetTenantId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var tenantClaim = user?.Claims.FirstOrDefault(c => c.Type == "CurrentTenantID")?.Value;

        if (string.IsNullOrEmpty(tenantClaim) || !int.TryParse(tenantClaim, out var tenantId))
            throw new InvalidOperationException("Unable to determine tenant ID from user claims");

        return tenantId;
    }

    private static PodData MapToPodData(JobViewModel job, IReadOnlyList<S3PhotoInfo> s3Photos)
    {
        // Separate signatures from delivery photos
        var signaturePhotos = s3Photos
            .Where(p => p.S3Key.Contains("DeliverySignatures/", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var deliveryPhotos = s3Photos
            .Where(p => p.S3Key.Contains("DeliveryPhotos/", StringComparison.OrdinalIgnoreCase))
            .ToList();

        // Get signature bytes from the first signature image
        var firstSignature = signaturePhotos.FirstOrDefault(p => !string.IsNullOrEmpty(p.Data));
        var signatureBytes = Convert.FromBase64String(firstSignature.Data);

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
            PodNotes = job.Notes?.FirstOrDefault()?.NoteText,
            SignatureImage = signatureBytes,
            Items = MapItems(job.ParcelDimensions),
            PhotoCategories = MapPhotoCategories(deliveryPhotos)
        };
    }

    private static List<PodItem> MapItems(List<ParcelDimensions>? parcels)
    {
        if (parcels == null || parcels.Count == 0)
            return [];

        return parcels.Select(p => new PodItem
        {
            ItemCode = p.ItemId?.ToString(),
            Barcode = p.Barcode,
            Description = p.ItemName
        }).ToList();
    }

    private static List<PhotoCategory> MapPhotoCategories(List<S3PhotoInfo> photos)
    {
        if (photos.Count == 0)
            return [];

        var podPhotos = photos
            .Where(p => !string.IsNullOrEmpty(p.Data))
            .Select(p => new PodPhoto
            {
                ImageBytes = Convert.FromBase64String(p.Data),
                Caption = p.FileName
            })
            .ToList();

        if (podPhotos.Count == 0)
            return [];

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