using DespatchWeb.Controllers;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class OverviewControllerTests
{
    private readonly IJobQueryRepository _jobRepoMock = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _courierRepoMock = Substitute.For<ICourierRepository>();

    private OverviewController CreateController() => new(_jobRepoMock, _courierRepoMock);

    [Fact]
    public async Task Index_ValidStatusGroup_ReturnsJson()
    {
        var parameters = new OverviewJobsRequest { StatusGroup = (int)JobStatusGroup.Active };
        var expected = new PaginatedResponse<DeliveryJob>();
        _jobRepoMock.GetJobsForOverviewPageAsync(JobStatusGroup.Active, parameters, Arg.Any<CancellationToken>()).Returns(expected);

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
        _jobRepoMock.GetJobsForOverviewPageAsync(Arg.Any<JobStatusGroup>(), Arg.Any<OverviewJobsRequest>(), Arg.Any<CancellationToken>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().Index(parameters);

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetAllRegions_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Auckland" } };
        _courierRepoMock.GetAllRegionsAsync().Returns(expected);

        var result = await CreateController().GetAllRegions();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllRegions_RepositoryThrows_Returns500()
    {
        _courierRepoMock.GetAllRegionsAsync().ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllRegions();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetStats_Success_ReturnsJson()
    {
        var expected = new OverviewStatsViewModel();
        _jobRepoMock.GetOverviewStatsAsync().Returns(expected);

        var result = await CreateController().GetStats();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetStats_RepositoryThrows_Returns500()
    {
        _jobRepoMock.GetOverviewStatsAsync().ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetStats();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetParentJobMap_Success_ReturnsJson()
    {
        var expected = new OverviewDeliveryMapResponse();
        _jobRepoMock.GetOverviewLocationDataAsync(1).Returns(expected);

        var result = await CreateController().GetParentJobMap(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetParentJobMap_RepositoryThrows_Returns500()
    {
        _jobRepoMock.GetOverviewLocationDataAsync(Arg.Any<int>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetParentJobMap(1);

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetAllSpeeds_Success_ReturnsJson()
    {
        var expected = new List<Suggestion> { new() { Id = 1, Text = "Express" } };
        _courierRepoMock.GetAllSpeedsAsync().Returns(expected);

        var result = await CreateController().GetAllSpeeds();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAllSpeeds_RepositoryThrows_Returns500()
    {
        _courierRepoMock.GetAllSpeedsAsync().ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetAllSpeeds();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetJobsForMegaMap_Success_ReturnsJson()
    {
        var expected = new List<MegaMapResponse>();
        _jobRepoMock.GetJobsForMegaMapAsync(Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().GetJobsForMegaMap();

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetJobsForMegaMap_RepositoryThrows_Returns500()
    {
        _jobRepoMock.GetJobsForMegaMapAsync(Arg.Any<CancellationToken>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetJobsForMegaMap();

        var status = Assert.IsType<StatusCodeResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetOpenJobs_Success_ReturnsJson()
    {
        var parameters = new OpenJobsRequest();
        var expected = new List<OpenJobResponse>();
        _jobRepoMock.GetOpenJobsAsync(parameters).Returns(expected);

        var result = await CreateController().GetOpenJobs(parameters);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetOpenJobs_RepositoryThrows_Returns500()
    {
        _jobRepoMock.GetOpenJobsAsync(Arg.Any<OpenJobsRequest>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetOpenJobs(new OpenJobsRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
