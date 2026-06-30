using System.Security.Claims;
using DeliverDifferentReporting.Models;
using DeliverDifferentReporting.Services;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class PodReportServiceIntegrationTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IHttpContextAccessor _httpContextAccessorMock = Substitute.For<IHttpContextAccessor>();
    private readonly ITenantBrandingService _tenantBrandingServiceMock = Substitute.For<ITenantBrandingService>();
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobPhotoService _jobPhotoServiceMock = Substitute.For<IJobPhotoService>();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private PodReportService CreateService() => new(
        _httpContextAccessorMock,
        _tenantBrandingServiceMock,
        _jobRepositoryMock,
        _jobPhotoServiceMock,
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
        _tenantBrandingServiceMock.GetBrandingAsync(42).Returns(new ReportBranding());
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
        _tenantBrandingServiceMock.GetBrandingAsync(42).Returns(new ReportBranding());
        _jobRepositoryMock.GetSingleJobById(1).Returns(JobWithItems(1));

        var service = CreateService();

        var (bytes, fileName) = await service.GeneratePodReportAsync(1);

        Assert.NotEmpty(bytes);
        Assert.StartsWith("POD-", fileName);
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
}
