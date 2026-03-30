using System.Security.Claims;
using DeliverDifferentReporting.Services;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Moq;

namespace DespatchWeb.Tests.Services;

public class PodReportServiceIntegrationTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock = new();
    private readonly Mock<ITenantBrandingService> _tenantBrandingServiceMock = new();
    private readonly Mock<IJobQueryRepository> _jobRepositoryMock = new();
    private readonly Mock<IJobPhotoService> _jobPhotoServiceMock = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private PodReportService CreateService() => new(
        _httpContextAccessorMock.Object,
        _tenantBrandingServiceMock.Object,
        _jobRepositoryMock.Object,
        _jobPhotoServiceMock.Object,
        _db.CreateFactoryMock().Object
    );

    private void SetupHttpContext(string tenantId = "42")
    {
        var claims = new List<Claim> { new("CurrentTenantID", tenantId) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        var httpContext = new DefaultHttpContext { User = principal };
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);
    }

    [Fact]
    public async Task GeneratePodReportAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        SetupHttpContext();
        // Branding setup not needed - test throws before branding is used
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(999)).ReturnsAsync((JobViewModel?)null);

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
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        var service = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GeneratePodReportAsync(1));
    }

    [Fact]
    public async Task GeneratePodSpreadsheetAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        SetupHttpContext();
        // Branding setup not needed - test throws before branding is used
        _jobRepositoryMock.Setup(x => x.GetSingleJobById(999)).ReturnsAsync((JobViewModel?)null);

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
