using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class AddressAutocompleteControllerTests
{
    private readonly IAddressLookupService _addressLookup = Substitute.For<IAddressLookupService>();

    private AddressAutocompleteController CreateController() => new(_addressLookup);

    [Fact]
    public async Task AutocompleteAddressSearch_Success_ReturnsJson()
    {
        var expected = new List<HereMapsLocationResult> { new() };
        _addressLookup
            .AutocompleteAddressSearchAsync("123 Main")
            .Returns(expected);

        var result = await CreateController().AutocompleteAddressSearch("123 Main");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task AutocompleteAddressSearch_ServiceThrows_Returns500()
    {
        // Arrange
        _addressLookup
            .AutocompleteAddressSearchAsync(Arg.Any<string>())
            .ThrowsAsync(new Exception("API error"));

        var controller = CreateController();

        // Act
        var result = await controller.AutocompleteAddressSearch("test");

        // Assert
        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetLocationDetailsById_Success_ReturnsJson()
    {
        var expected = new HereMapsLookupResponse();
        _addressLookup.GetLocationDetailsByIdAsync("addr-123").Returns(expected);

        var result = await CreateController().GetLocationDetailsById("addr-123");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task GetLocationDetailsById_EmptyAddressId_ReturnsBadRequest(string? addressId)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetLocationDetailsById(addressId!);

        // Assert
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("addressId is required.", badRequest.Value);

        await _addressLookup
            .DidNotReceive()
            .GetLocationDetailsByIdAsync(Arg.Any<string>());
    }

    [Fact]
    public async Task GetLocationDetailsById_ServiceThrows_Returns500()
    {
        _addressLookup.GetLocationDetailsByIdAsync(Arg.Any<string>()).ThrowsAsync(new Exception("API error"));

        var result = await CreateController().GetLocationDetailsById("addr-123");

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task FetchNearestAddress_Success_ReturnsJson()
    {
        var expected = new List<HereMapsLocationResult> { new() };
        _addressLookup.FetchNearestAddressAsync(-36, 174)
            .Returns(expected);

        var result = await CreateController().FetchNearestAddress(-36, 174);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task FetchNearestAddress_ServiceThrows_Returns500()
    {
        _addressLookup.FetchNearestAddressAsync(Arg.Any<double>(), Arg.Any<double>())
            .ThrowsAsync(new Exception("API error"));

        var result = await CreateController().FetchNearestAddress(-36, 174);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}