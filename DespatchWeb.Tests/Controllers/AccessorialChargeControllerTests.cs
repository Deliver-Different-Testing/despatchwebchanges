using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class AccessorialChargeControllerTests
{
    private readonly Mock<IAccessorialChargeService> _serviceMock = new();

    private AccessorialChargeController CreateController() => new(_serviceMock.Object);

    [Fact]
    public async Task GetAvailable_Success_ReturnsJson()
    {
        var expected = new List<AccessorialChargeDto> { new() };
        _serviceMock.Setup(x => x.GetAvailableChargesAsync(1, 2)).ReturnsAsync(expected);

        var result = await CreateController().GetAvailable(1, 2);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAvailable_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.GetAvailableChargesAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ThrowsAsync(new Exception("Database error"));

        var result = await CreateController().GetAvailable(1, 2);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetApplied_Success_ReturnsJson()
    {
        var expected = new List<JobAccessorialChargeDto> { new() };
        _serviceMock.Setup(x => x.GetAppliedChargesAsync(1)).ReturnsAsync(expected);

        var result = await CreateController().GetApplied(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetApplied_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.GetAppliedChargesAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetApplied(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Add_Success_ReturnsJsonWithSuccess()
    {
        var charges = new List<JobAccessorialChargeCreateRequest> { new() };
        _serviceMock.Setup(x => x.AddChargesAsync(1, charges)).Returns(Task.CompletedTask);

        var result = await CreateController().Add(1, charges);

        Assert.IsType<JsonResult>(result);
        _serviceMock.Verify(x => x.AddChargesAsync(1, charges), Times.Once);
    }

    [Fact]
    public async Task Add_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.AddChargesAsync(It.IsAny<int>(), It.IsAny<List<JobAccessorialChargeCreateRequest>>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Add(1, []);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Update_Success_ReturnsJsonWithUpdated()
    {
        var request = new JobAccessorialChargeUpdateRequest();
        var expected = new JobAccessorialChargeDto();
        _serviceMock.Setup(x => x.UpdateChargeAsync(1, request)).ReturnsAsync(expected);

        var result = await CreateController().Update(1, request);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task Update_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.UpdateChargeAsync(It.IsAny<int>(), It.IsAny<JobAccessorialChargeUpdateRequest>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Update(1, new JobAccessorialChargeUpdateRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task JobAmount_Success_ReturnsJson()
    {
        _serviceMock.Setup(x => x.GetJobAmountAsync(1)).ReturnsAsync(99.50m);

        var result = await CreateController().JobAmount(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equal(99.50m, json.Value);
    }

    [Fact]
    public async Task JobAmount_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.GetJobAmountAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().JobAmount(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetPortions_Success_ReturnsJson()
    {
        var expected = new List<PortionJobInfoDto> { new() };
        _serviceMock.Setup(x => x.GetPortionJobsAsync(1)).ReturnsAsync(expected);

        var result = await CreateController().GetPortions(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetPortions_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.GetPortionJobsAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetPortions(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Delete_Success_ReturnsJsonWithSuccess()
    {
        _serviceMock.Setup(x => x.DeleteChargeAsync(1)).Returns(Task.CompletedTask);

        var result = await CreateController().Delete(1);

        Assert.IsType<JsonResult>(result);
        _serviceMock.Verify(x => x.DeleteChargeAsync(1), Times.Once);
    }

    [Fact]
    public async Task Delete_ServiceThrows_Returns500()
    {
        _serviceMock.Setup(x => x.DeleteChargeAsync(It.IsAny<int>()))
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Delete(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
