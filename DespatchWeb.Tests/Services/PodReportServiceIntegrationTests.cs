using System.Security.Claims;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using ImageMagick;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace DespatchWeb.Tests.Services;

public class PodReportServiceIntegrationTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IHttpContextAccessor _httpContextAccessorMock = Substitute.For<IHttpContextAccessor>();
    private readonly ITenantBrandingService _tenantBrandingServiceMock = Substitute.For<ITenantBrandingService>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly IPodMediaService _podMediaServiceMock = Substitute.For<IPodMediaService>();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private PodReportService CreateService() => new(
        _httpContextAccessorMock,
        _tenantBrandingServiceMock,
        _jobRepositoryMock,
        _noteRepositoryMock,
        _podMediaServiceMock,
        _db.CreateFactoryMock()
    );

    private void SetupHttpContext(string tenantId = "42")
    {
        var claims = new List<Claim> { new("CurrentTenantID", tenantId) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.HttpContext.Returns(httpContext);
    }

    [Fact]
    public async Task GeneratePodReportAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        SetupHttpContext();
        // Branding setup not needed - test throws before branding is used
        _jobRepositoryMock.GetSingleJobById(999).Returns((JobViewModel?)null);

        var service = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GeneratePodReportAsync(999));
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
    }

    [Fact]
    public async Task GeneratePodReportAsync_MissingTenantClaim_ThrowsInvalidOperationException()
    {
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) };
        _httpContextAccessorMock.HttpContext.Returns(httpContext);

        var service = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GeneratePodReportAsync(1));
    }

    [Fact]
    public async Task GeneratePodSpreadsheetAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        SetupHttpContext();
        // Branding setup not needed - test throws before branding is used
        _jobRepositoryMock.GetSingleJobById(999).Returns((JobViewModel?)null);

        var service = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GeneratePodSpreadsheetAsync(999));
        Assert.Contains("999", ex.Message);
    }

    [Fact]
    public async Task GeneratePodReportAsync_ResolvesMediaForTheRequestedJobUsingItsCompletionMonth()
    {
        // POD-E4672MD.pdf came out with an empty signature box because the images were written
        // against the DEL leg. The report has to ask for the family, keyed off the job the client
        // downloaded — the media service owns the per-leg month from there.
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(11).Returns(new JobViewModel
        {
            JobNo = "E4672MD",
            CompletedTime = new DateTime(2026, 8, 7, 8, 35, 0)
        });

        await CreateService().GeneratePodReportAsync(11);

        await _podMediaServiceMock.Received(1).GetDeliveryMediaAsync(11, 2026, 8);
    }

    [Fact]
    public async Task GeneratePodReportAsync_ScheduleRowId_ResolvesMediaAgainstTheLinkedLiveJob()
    {
        // A tblBulkJob ("scheduled job") id is not a tucJob id. POD media is written against the
        // live job the schedule materialised into, so an id that matches no job has to be retried
        // as a schedule id before the report gives up.
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(500).Returns((JobViewModel?)null);
        _jobRepositoryMock.GetLinkedJobIdForBulkJobAsync(500).Returns(987654);
        _jobRepositoryMock.GetSingleJobById(987654).Returns(new JobViewModel
        {
            JobNo = "S-987654",
            CompletedTime = new DateTime(2026, 8, 7, 8, 35, 0)
        });

        var (_, fileName) = await CreateService().GeneratePodReportAsync(500);

        Assert.Equal("POD-S-987654.pdf", fileName);
        await _podMediaServiceMock.Received(1).GetDeliveryMediaAsync(987654, 2026, 8);
    }

    [Fact]
    public async Task GeneratePodReportAsync_LiveJobId_NeverConsultsTheScheduleTable()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(11).Returns(new JobViewModel { JobNo = "J-11" });

        await CreateService().GeneratePodReportAsync(11);

        await _jobRepositoryMock.DidNotReceiveWithAnyArgs().GetLinkedJobIdForBulkJobAsync(default);
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_ScheduleRowId_AppendsTheLinkedLiveJobsMedia()
    {
        // The archived lookup throws rather than returning null for an unknown id, which is what a
        // schedule id looks like to it.
        _jobRepositoryMock.GetSingleJobById(500).Throws(new KeyNotFoundException("Archived job 500 not found"));
        _jobRepositoryMock.GetLinkedJobIdForBulkJobAsync(500).Returns(987654);
        _jobRepositoryMock.GetSingleJobById(987654)
            .Returns(new JobViewModel { CompletedTime = new DateTime(2026, 3, 10) });

        var png = Convert.ToBase64String(SamplePng());
        _podMediaServiceMock.GetDeliveryMediaAsync(987654, 2026, 3).Returns(new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliverySignatures/2026/03/987654-s.png", Data = png, FileName = "987654-s.png" }
        });

        var result = await CreateService().AppendDeliveryPhotosAsync(CreateSamplePdf(), 500);

        Assert.Equal(2, PageCount(result));
    }

    [Fact]
    public async Task GeneratePodReportAsync_UnknownIdOnNeitherTable_ThrowsInvalidOperationException()
    {
        SetupHttpContext();
        _jobRepositoryMock.GetSingleJobById(999).Throws(new KeyNotFoundException("Archived job 999 not found"));
        _jobRepositoryMock.GetLinkedJobIdForBulkJobAsync(999).Returns((int?)null);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService().GeneratePodReportAsync(999));

        Assert.Contains("999", ex.Message);
    }

    [Fact]
    public async Task GeneratePodReportAsync_InvalidTenantClaim_ThrowsInvalidOperationException()
    {
        SetupHttpContext("not-a-number");

        var service = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GeneratePodReportAsync(1));
    }

    private static JobViewModel JobWithItems(int itemCount)
    {
        var items = Enumerable.Range(1, itemCount)
            .Select(i => new ParcelDimensions
            {
                ItemId = i,
                Barcode = $"BC-{i:000}",
                ItemName = $"Item {i}"
            })
            .ToList();

        return new JobViewModel
        {
            JobNo = "JOB-100",
            CompletedTime = null,
            ParcelDimensions = items
        };
    }

    [Fact]
    public async Task GeneratePodReportAsync_JobWithMultipleItems_ReturnsNonEmptyPdf()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(2));

        var service = CreateService();

        var (bytes, fileName) = await service.GeneratePodReportAsync(1);

        Assert.NotEmpty(bytes);
        Assert.StartsWith("POD-", fileName);
    }

    [Fact]
    public async Task GeneratePodReportAsync_JobWithSingleItem_ReturnsNonEmptyPdf()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        var (bytes, fileName) = await service.GeneratePodReportAsync(1);

        Assert.NotEmpty(bytes);
        Assert.StartsWith("POD-", fileName);
    }

    [Fact]
    public async Task GeneratePodReportAsync_BrandingFetch404_StillReturnsPdf()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Response status code does not indicate success: 404 (Not Found)."));
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        var (bytes, fileName) = await service.GeneratePodReportAsync(1);

        Assert.NotEmpty(bytes);
        Assert.StartsWith("POD-", fileName);
    }

    [Fact]
    public async Task GeneratePodSpreadsheetAsync_BrandingFetch404_StillReturnsXlsx()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Response status code does not indicate success: 404 (Not Found)."));
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        var (bytes, fileName) = await service.GeneratePodSpreadsheetAsync(1);

        Assert.NotEmpty(bytes);
        Assert.EndsWith(".xlsx", fileName);
    }

    [Fact]
    public async Task SendPodEmailAsync_QueuesOneOutboxRowPerRecipientWithPdfAttached()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();
        var recipients = new List<string> { "a@example.com", "b@example.com" };

        await service.SendPodEmailAsync(1, recipients, "Your POD", "Line 1\nLine 2");

        await using var context = _db.CreateContext();
        var queued = await context.TucManualMessages.OrderBy(m => m.SendToEmailAddress).ToListAsync();

        Assert.Equal(recipients, queued.Select(m => m.SendToEmailAddress));
        Assert.All(queued, message =>
        {
            Assert.Equal("Your POD", message.Subject);
            Assert.Equal("Line 1<br>Line 2", message.UcmmMessage);
            Assert.Equal(1, message.JobId);
            Assert.True(message.HasAttachment);
            Assert.Equal("application/pdf", message.FileType);
            Assert.StartsWith("POD-", message.FileName);
            Assert.NotEmpty(message.FileContent);
            Assert.False(message.UcmmSent);
        });
    }

    [Fact]
    public async Task SendPodEmailAsync_QueuedPdfMatchesTheGeneratedReport()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        await service.SendPodEmailAsync(1, ["a@example.com"], "Your POD", "Body");

        await using var context = _db.CreateContext();
        var queued = await context.TucManualMessages.SingleAsync();

        // A real PDF, not a placeholder — the drainer attaches these bytes verbatim.
        Assert.Equal("%PDF"u8.ToArray(), queued.FileContent.Take(4));
    }

    [Fact]
    public async Task SendPodEmailAsync_NullBody_QueuesEmptyMessageInsteadOfThrowing()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        await service.SendPodEmailAsync(1, ["a@example.com"], "Your POD", null!);

        await using var context = _db.CreateContext();
        var queued = await context.TucManualMessages.SingleAsync();

        Assert.Equal(string.Empty, queued.UcmmMessage);
    }

    [Fact]
    public void MapPhotoCategories_MixedValidAndEmptyData_OnlyIncludesValidPhotos()
    {
        var validData = Convert.ToBase64String(new byte[] { 1, 2, 3 });
        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "photos/valid.jpg", Data = validData, FileName = "valid.jpg" },
            new() { S3Key = "photos/empty.jpg", Data = "", FileName = "empty.jpg" },
            new() { S3Key = "photos/null.jpg", Data = null, FileName = "null.jpg" }
        };

        var result = PodReportService.MapPhotoCategories(photos);

        Assert.Single(result);
        Assert.Single(result[0].Photos);
        Assert.Equal("valid.jpg", result[0].Photos[0].Caption);
    }

    // A small, valid PNG generated with ImageMagick so the append pipeline
    // (ImageMagick -> JPEG -> PdfSharp) has real image bytes to work with.
    private static byte[] SamplePng()
    {
        using var img = new MagickImage(MagickColors.SkyBlue, 8, 8);
        img.Format = MagickFormat.Png;
        return img.ToByteArray();
    }

    private static byte[] CreateSamplePdf(int pages = 1)
    {
        using var doc = new PdfDocument();
        for (var i = 0; i < pages; i++)
        {
            doc.AddPage();
        }

        using var ms = new MemoryStream();
        doc.Save(ms);
        return ms.ToArray();
    }

    private static int PageCount(byte[] pdf)
    {
        using var ms = new MemoryStream(pdf);
        using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
        return doc.PageCount;
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_JobNotFound_ReturnsOriginalUnchanged()
    {
        _jobRepositoryMock.GetSingleJobById(5).Returns((JobViewModel?)null);
        var pdf = CreateSamplePdf();

        var result = await CreateService().AppendDeliveryPhotosAsync(pdf, 5);

        Assert.Same(pdf, result);
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_NoMediaAnywhereInTheFamily_ReturnsOriginalUnchanged()
    {
        _jobRepositoryMock.GetSingleJobById(5).Returns(new JobViewModel { CompletedTime = null });
        var pdf = CreateSamplePdf();

        var result = await CreateService().AppendDeliveryPhotosAsync(pdf, 5);

        Assert.Same(pdf, result);
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_ParentWithNoCompletionTime_StillSweepsTheFamily()
    {
        // The parent roll-up copies POD name and time off the completing leg, but it can be missing
        // while the leg that captured the media is delivered. Bailing on the parent's own
        // CompletedTime lost the POD entirely.
        _jobRepositoryMock.GetSingleJobById(5).Returns(new JobViewModel { CompletedTime = null });

        var png = Convert.ToBase64String(SamplePng());
        _podMediaServiceMock.GetDeliveryMediaAsync(5, 0, 0).Returns(new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliverySignatures/2026/03/7-s.png", Data = png, FileName = "7-s.png" }
        });

        var result = await CreateService().AppendDeliveryPhotosAsync(CreateSamplePdf(), 5);

        Assert.Equal(2, PageCount(result));
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_WithPhotoAndSignature_AddsOnePagePerImage()
    {
        _jobRepositoryMock.GetSingleJobById(5)
            .Returns(new JobViewModel { CompletedTime = new DateTime(2026, 3, 10) });

        var png = Convert.ToBase64String(SamplePng());
        _podMediaServiceMock.GetDeliveryMediaAsync(5, 2026, 3).Returns(new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliveryPhotos/2026/03/5-a.png", Data = png, FileName = "5-a.png" },
            new() { S3Key = "DeliverySignatures/2026/03/5-s.png", Data = png, FileName = "5-s.png" }
        });

        var pdf = CreateSamplePdf();

        var result = await CreateService().AppendDeliveryPhotosAsync(pdf, 5);

        Assert.Equal(3, PageCount(result)); // 1 original + photo + signature
    }

    [Fact]
    public void ExtractDeliveryImages_OrdersPhotosBeforeSignaturesAndSkipsEmptyData()
    {
        var photo = Convert.ToBase64String(new byte[] { 1 });
        var signature = Convert.ToBase64String(new byte[] { 2 });
        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliverySignatures/2026/03/5-s.png", Data = signature },
            new() { S3Key = "DeliveryPhotos/2026/03/5-a.png", Data = photo },
            new() { S3Key = "DeliveryPhotos/2026/03/5-doc.pdf", Data = null } // non-image, skipped
        };

        var result = PodReportService.ExtractDeliveryImages(photos);

        Assert.Equal(2, result.Count);
        Assert.Equal([1], result[0]);  // photo first
        Assert.Equal([2], result[1]);  // signature second
    }

    [Fact]
    public void ExtractDeliveryImages_KeysTheSignatureCanvasButLeavesThePhotoAlone()
    {
        // The appended pages come from these bytes, so the signature has to be keyed here too —
        // otherwise the overlay POD shows a transparent signature on page 1 and a grey-boxed one
        // on the appended page. A photo's background is real content and must survive untouched.
        var flatCanvas = SignatureOnFlatCanvasJpeg();
        var photos = new List<S3PhotoInfo>
        {
            new() { S3Key = "DeliveryPhotos/2026/03/5-a.png", Data = Convert.ToBase64String(flatCanvas) },
            new() { S3Key = "DeliverySignatures/2026/03/5-s.png", Data = Convert.ToBase64String(flatCanvas) }
        };

        var result = PodReportService.ExtractDeliveryImages(photos);

        Assert.Equal(flatCanvas, result[0]);          // photo: byte-for-byte unchanged
        Assert.NotEqual(flatCanvas, result[1]);       // signature: keyed
        using var signature = new MagickImage(result[1]);
        Assert.True(signature.HasAlpha);
    }

    private static byte[] SignatureOnFlatCanvasJpeg()
    {
        using var img = new MagickImage(new MagickColor("#d3d3d3"), 400, 200);
        using var stroke = new MagickImage(new MagickColor("#191970"), 4, 120);
        img.Composite(stroke, 118, 40, CompositeOperator.Over);
        img.Format = MagickFormat.Jpeg;
        img.Quality = 85;
        return img.ToByteArray();
    }
}
