using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

[TestSubject(typeof(AccessorialChargeController))]
public class AccessorialChargeControllerTests
{
    private readonly IAccessorialChargeService _accessorialChargeService = Substitute.For<IAccessorialChargeService>();

    private AccessorialChargeController CreateController() => new(_accessorialChargeService);

    [Fact]
    public async Task GetAvailable_Success_ReturnsJson()
    {
        var expected = new List<AccessorialChargeDto> { new() };
        _accessorialChargeService.GetAvailableChargesAsync(1, 2).Returns(expected);

        var result = await CreateController().GetAvailable(1, 2);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetAvailable_ServiceThrows_Returns500()
    {
        _accessorialChargeService.GetAvailableChargesAsync(Arg.Any<int>(), Arg.Any<int>())
            .ThrowsAsync(new Exception("Database error"));

        var result = await CreateController().GetAvailable(1, 2);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetApplied_Success_ReturnsJson()
    {
        var expected = new List<JobAccessorialChargeDto> { new() };
        _accessorialChargeService.GetAppliedChargesAsync(1).Returns(expected);

        var result = await CreateController().GetApplied(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetApplied_ServiceThrows_Returns500()
    {
        _accessorialChargeService.GetAppliedChargesAsync(Arg.Any<int>())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().GetApplied(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Add_Success_ReturnsJsonWithSuccess()
    {
        var charges = new List<JobAccessorialChargeCreateRequest> { new() };
        _accessorialChargeService
            .AddChargesAsync(1, charges)
            .Returns(Task.CompletedTask);

        var result = await CreateController().Add(1, charges);

        Assert.IsType<JsonResult>(result);
        await _accessorialChargeService
            .Received(1)
            .AddChargesAsync(1, charges);
    }

    [Fact]
    public async Task Add_ServiceThrows_Returns500()
    {
        _accessorialChargeService.AddChargesAsync(Arg.Any<int>(), Arg.Any<List<JobAccessorialChargeCreateRequest>>())
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
        _accessorialChargeService.UpdateChargeAsync(1, request).Returns(expected);

        var result = await CreateController().Update(1, request);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task Update_ServiceThrows_Returns500()
    {
        _accessorialChargeService.UpdateChargeAsync(Arg.Any<int>(), Arg.Any<JobAccessorialChargeUpdateRequest>())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Update(1, new JobAccessorialChargeUpdateRequest());

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task JobAmount_Success_ReturnsJson()
    {
        _accessorialChargeService.GetJobAmountAsync(1).Returns(99.50m);

        var result = await CreateController().JobAmount(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equal(99.50m, json.Value);
    }

    [Fact]
    public async Task JobAmount_ServiceThrows_Returns500()
    {
        _accessorialChargeService.GetJobAmountAsync(Arg.Any<int>()).ThrowsAsync(new Exception("error"));

        var result = await CreateController().JobAmount(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetPortions_Success_ReturnsJson()
    {
        var expected = new List<PortionJobInfoDto> { new() };
        _accessorialChargeService.GetPortionJobsAsync(1).Returns(expected);

        var result = await CreateController().GetPortions(1);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task GetPortions_ServiceThrows_Returns500()
    {
        _accessorialChargeService.GetPortionJobsAsync(Arg.Any<int>()).ThrowsAsync(new Exception("error"));
        var result = await CreateController().GetPortions(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Delete_Success_ReturnsJsonWithSuccess()
    {
        // Arrange
        _accessorialChargeService
            .DeleteChargeAsync(1)
            .Returns(Task.CompletedTask);

        var controller = CreateController();

        // Act
        var result = await controller.Delete(1);

        // Assert
        Assert.IsType<JsonResult>(result);

        await _accessorialChargeService
            .Received(1)
            .DeleteChargeAsync(1);
    }

    [Fact]
    public async Task Delete_ServiceThrows_Returns500()
    {
        _accessorialChargeService.DeleteChargeAsync(Arg.Any<int>())
            .ThrowsAsync(new Exception("error"));

        var result = await CreateController().Delete(1);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}