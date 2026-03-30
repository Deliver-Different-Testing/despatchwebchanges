using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

public class AddressAutocompleteControllerTests
{
    private readonly Mock<IAddressLookupService> _addressLookupMock = new();

    private AddressAutocompleteController CreateController() => new(_addressLookupMock.Object);

    [Fact]
    public async Task AutocompleteAddressSearch_Success_ReturnsJson()
    {
        var expected = new List<HereMapsLocationResult> { new() };
        _addressLookupMock.Setup(x => x.AutocompleteAddressSearchAsync("123 Main"))
            .ReturnsAsync(expected);

        var result = await CreateController().AutocompleteAddressSearch("123 Main");

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task AutocompleteAddressSearch_ServiceThrows_Returns500()
    {
        _addressLookupMock.Setup(x => x.AutocompleteAddressSearchAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("API error"));

        var result = await CreateController().AutocompleteAddressSearch("test");

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task GetLocationDetailsById_Success_ReturnsJson()
    {
        var expected = new HereMapsLookupResponse();
        _addressLookupMock.Setup(x => x.GetLocationDetailsByIdAsync("addr-123"))
            .ReturnsAsync(expected);

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
        var result = await CreateController().GetLocationDetailsById(addressId!);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("addressId is required.", badRequest.Value);
        _addressLookupMock.Verify(x => x.GetLocationDetailsByIdAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetLocationDetailsById_ServiceThrows_Returns500()
    {
        _addressLookupMock.Setup(x => x.GetLocationDetailsByIdAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("API error"));

        var result = await CreateController().GetLocationDetailsById("addr-123");

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task FetchNearestAddress_Success_ReturnsJson()
    {
        var expected = new List<HereMapsLocationResult> { new() };
        _addressLookupMock.Setup(x => x.FetchNearestAddressAsync(-36, 174))
            .ReturnsAsync(expected);

        var result = await CreateController().FetchNearestAddress(-36, 174);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(expected, json.Value);
    }

    [Fact]
    public async Task FetchNearestAddress_ServiceThrows_Returns500()
    {
        _addressLookupMock.Setup(x => x.FetchNearestAddressAsync(It.IsAny<double>(), It.IsAny<double>()))
            .ThrowsAsync(new Exception("API error"));

        var result = await CreateController().FetchNearestAddress(-36, 174);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
