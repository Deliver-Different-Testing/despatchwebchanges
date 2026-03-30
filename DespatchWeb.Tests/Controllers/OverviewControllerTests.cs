using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class OverviewControllerTests
{
    private readonly Mock<IJobQueryRepository> _jobRepoMock = new();
    private readonly Mock<ICourierRepository> _courierRepoMock = new();

    private OverviewController CreateController() => new(_jobRepoMock.Object, _courierRepoMock.Object);

    [Fact]
    public async Task Index_ValidStatusGroup_ReturnsJson()
    {
        var parameters = new OverviewJobsRequest { StatusGroup = (int)JobStatusGroup.Active };
        var expected = new PaginatedResponse<DeliveryJob>();
        _jobRepoMock.Setup(x => x.GetJobsForOverviewPageAsync(JobStatusGroup.Active, parameters))
            .ReturnsAsync(expected);

        var result = await CreateController().Index(parameters);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task Index_InvalidStatusGroup_ReturnsBadRequest()
    {
        var parameters = new OverviewJobsRequest { StatusGroup = 999 };

        var result = await CreateController().Index(parameters);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("999", badRequest.Value?.ToString());
    }

    [Fact]
    public async Task Index_RepositoryThrows_Returns500()
    {
        var parameters = new OverviewJobsRequest { StatusGroup = (int)JobStatusGroup.Active };
        _jobRepoMock.Setup(x => x.GetJobsForOverviewPageAsync(It.IsAny<JobStatusGroup>(), It.IsAny<OverviewJobsRequest>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Index(parameters);

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetAllRegions_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Auckland" } };
        _courierRepoMock.Setup(x => x.GetAllRegionsAsync()).ReturnsAsync(expected);

        var result = await CreateController().GetAllRegions();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllRegions_RepositoryThrows_Returns500()
    {
        _courierRepoMock.Setup(x => x.GetAllRegionsAsync())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllRegions();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetStats_Success_ReturnsJson()
    {
        var expected = new OverviewStatsViewModel();
        _jobRepoMock.Setup(x => x.GetOverviewStatsAsync()).ReturnsAsync(expected);

        var result = await CreateController().GetStats();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetStats_RepositoryThrows_Returns500()
    {
        _jobRepoMock.Setup(x => x.GetOverviewStatsAsync())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetStats();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetParentJobMap_Success_ReturnsJson()
    {
        var expected = new OverviewDeliveryMapResponse();
        _jobRepoMock.Setup(x => x.GetOverviewLocationDataAsync(1)).ReturnsAsync(expected);

        var result = await CreateController().GetParentJobMap(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetParentJobMap_RepositoryThrows_Returns500()
    {
        _jobRepoMock.Setup(x => x.GetOverviewLocationDataAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetParentJobMap(1);

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetAllSpeeds_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Express" } };
        _courierRepoMock.Setup(x => x.GetAllSpeedsAsync()).ReturnsAsync(expected);

        var result = await CreateController().GetAllSpeeds();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllSpeeds_RepositoryThrows_Returns500()
    {
        _courierRepoMock.Setup(x => x.GetAllSpeedsAsync())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllSpeeds();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetJobsForMegaMap_Success_ReturnsJson()
    {
        var expected = new List<MegaMapResponse>();
        _jobRepoMock.Setup(x => x.GetJobsForMegaMapAsync(It.IsAny<CancellationToken>())).ReturnsAsync(expected);

        var result = await CreateController().GetJobsForMegaMap();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetJobsForMegaMap_RepositoryThrows_Returns500()
    {
        _jobRepoMock.Setup(x => x.GetJobsForMegaMapAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetJobsForMegaMap();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetOpenJobs_Success_ReturnsJson()
    {
        var parameters = new OpenJobsRequest();
        var expected = new List<OpenJobResponse>();
        _jobRepoMock.Setup(x => x.GetOpenJobsAsync(parameters)).ReturnsAsync(expected);

        var result = await CreateController().GetOpenJobs(parameters);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetOpenJobs_RepositoryThrows_Returns500()
    {
        _jobRepoMock.Setup(x => x.GetOpenJobsAsync(It.IsAny<OpenJobsRequest>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetOpenJobs(new OpenJobsRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
