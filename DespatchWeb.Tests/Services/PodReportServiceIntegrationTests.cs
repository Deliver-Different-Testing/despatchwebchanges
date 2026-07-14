using System.Security.Claims;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using ImageMagick;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace DespatchWeb.Tests.Services;

public class PodReportServiceIntegrationTests
{
    private readonly IHttpContextAccessor _httpContextAccessorMock = Substitute.For<IHttpContextAccessor>();
    private readonly ITenantBrandingService _tenantBrandingServiceMock = Substitute.For<ITenantBrandingService>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _noteRepositoryMock = Substitute.For<INoteRepository>();
    private readonly IJobPhotoService _jobPhotoServiceMock = Substitute.For<IJobPhotoService>();
    private readonly IEmailSender _emailSenderMock = Substitute.For<IEmailSender>();

    private PodReportService CreateService() => new(
        _httpContextAccessorMock,
        _tenantBrandingServiceMock,
        _jobRepositoryMock,
        _noteRepositoryMock,
        _jobPhotoServiceMock,
        _emailSenderMock
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
    public async Task SendPodEmailAsync_SendsToEachRecipientWithPdfAttachment()
    {
        SetupHttpContext();
        _tenantBrandingServiceMock.GetBrandingAsync(42, Arg.Any<CancellationToken>()).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();
        var recipients = new List<string> { "a@example.com", "b@example.com" };

        await service.SendPodEmailAsync(1, recipients, "Your POD", "Line 1\nLine 2");

        foreach (var recipient in recipients)
        {
            await _emailSenderMock.Received(1).SendAsync(
                recipient,
                "Your POD",
                Arg.Is<string>(b => b.Contains("Line 1<br>Line 2")),
                Arg.Any<string?>(),
                Arg.Is<EmailAttachment>(att => att.ContentType == "application/pdf" && att.Content.Length > 0),
                Arg.Any<CancellationToken>());
        }
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
    public async Task AppendDeliveryPhotosAsync_JobNotCompleted_ReturnsOriginalAndSkipsS3()
    {
        _jobRepositoryMock.GetSingleJobById(5).Returns(new JobViewModel { CompletedTime = null });
        var pdf = CreateSamplePdf();

        var result = await CreateService().AppendDeliveryPhotosAsync(pdf, 5);

        Assert.Same(pdf, result);
        await _jobPhotoServiceMock.DidNotReceiveWithAnyArgs().GetDeliveryPhotosAsync(0, 0, 0);
    }

    [Fact]
    public async Task AppendDeliveryPhotosAsync_WithPhotoAndSignature_AddsOnePagePerImage()
    {
        _jobRepositoryMock.GetSingleJobById(5)
            .Returns(new JobViewModel { CompletedTime = new DateTime(2026, 3, 10) });

        var png = Convert.ToBase64String(SamplePng());
        _jobPhotoServiceMock.GetDeliveryPhotosAsync(5, 2026, 3).Returns(new List<S3PhotoInfo>
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
}
