using System.Net;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using NSubstitute;

// Alias for HereMaps Address which is just called Address in the Models
using HereMapsAddress = DespatchWeb.Models.Address;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddressLookupService - tests HERE Maps API integration for address lookup.
/// </summary>
public class AddressLookupServiceTests
{
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeHttpMessageHandler _httpHandler = new();

    public AddressLookupServiceTests()
    {
        // Set required environment variable for HERE Maps API
        Environment.SetEnvironmentVariable("HereMapsAPIKey", "test-api-key");
    }

    private AddressLookupService CreateService()
    {
        var httpClient = new HttpClient(_httpHandler);
        return new AddressLookupService(httpClient, _tenantInfoServiceMock);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("ab")]
    public async Task AutocompleteAddressSearchAsync_InvalidText_ReturnsEmptyList(string? text)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync(text);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_TextTooShort_ReturnsEmptyList()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync("12");

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_UsCustomer_SendsUsaCountryCode()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        SetupHttpResponse(new HereMapsAutocompleteResponse { Items = [] });
        var service = CreateService();

        // Act
        await service.AutocompleteAddressSearchAsync("123 Main");

        // Assert
        Assert.Single(_httpHandler.Requests);
        Assert.Contains("countryCode%3AUSA", _httpHandler.Requests[0].RequestUri!.ToString());
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_NzCustomer_SendsNzlCountryCode()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        SetupHttpResponse(new HereMapsAutocompleteResponse { Items = [] });
        var service = CreateService();

        // Act
        await service.AutocompleteAddressSearchAsync("123 Main");

        // Assert
        Assert.Single(_httpHandler.Requests);
        Assert.Contains("countryCode%3ANZL", _httpHandler.Requests[0].RequestUri!.ToString());
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_ValidResponse_ReturnsResults()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        var response = new HereMapsAutocompleteResponse
        {
            Items =
            [
                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "123 Main St, New York, NY" },
                    ResultType = "place"
                },

                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "123 Main Ave, Chicago, IL" },
                    ResultType = "place"
                }
            ]
        };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync("123 Main");

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal("123 Main St, New York, NY", result[0].Address.Label);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_FiltersCategoryQueries()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        var response = new HereMapsAutocompleteResponse
        {
            Items =
            [
                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "Valid Address" },
                    ResultType = "place"
                },

                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "Category Result" },
                    ResultType = "categoryQuery"
                },

                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "Chain Result" },
                    ResultType = "chainQuery"
                }
            ]
        };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync("coffee");

        // Assert
        Assert.Single(result);
        Assert.Equal("Valid Address", result[0].Address.Label);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_FiltersNullAddressLabels()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        var response = new HereMapsAutocompleteResponse
        {
            Items =
            [
                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "Valid Address" },
                    ResultType = "place"
                },

                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = null },
                    ResultType = "place"
                },

                new HereMapsLocationResult
                {
                    Address = null,
                    ResultType = "place"
                }
            ]
        };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync("test address");

        // Assert
        Assert.Single(result);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_HttpError_ThrowsException()
    {
        // Arrange
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        SetupHttpError(HttpStatusCode.InternalServerError);
        var service = CreateService();

        // Assert
        await Assert.ThrowsAsync<HttpRequestException>((Func<Task<IReadOnlyList<HereMapsLocationResult>>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<IReadOnlyList<HereMapsLocationResult>> Act() => await service.AutocompleteAddressSearchAsync("test");
    }

    [Fact]
    public async Task GetLocationDetailsByIdAsync_ValidId_ReturnsLocationDetails()
    {
        // Arrange
        var expectedResponse = new HereMapsLookupResponse
        {
            Address = new HereMapsAddress
            {
                Label = "123 Main St, Auckland",
                Street = "Main St",
                HouseNumber = "123"
            }
        };
        SetupHttpResponse(expectedResponse);
        var service = CreateService();

        // Act
        var result = await service.GetLocationDetailsByIdAsync("here:pds:place:36jx7ps-12345");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("123 Main St, Auckland", result.Address.Label);
    }

    [Fact]
    public async Task GetLocationDetailsByIdAsync_HttpError_ThrowsException()
    {
        // Arrange
        SetupHttpError(HttpStatusCode.NotFound);
        var service = CreateService();

        // Assert
        await Assert.ThrowsAsync<HttpRequestException>((Func<Task<HereMapsLookupResponse>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<HereMapsLookupResponse> Act() => await service.GetLocationDetailsByIdAsync("invalid-id");
    }

    [Fact]
    public async Task FetchNearestAddressAsync_ValidCoordinates_ReturnsAddress()
    {
        // Arrange
        var response = new HereMapsAutocompleteResponse
        {
            Items =
            [
                new HereMapsLocationResult
                {
                    Address = new HereMapsAddress { Label = "Nearest Address" }
                }
            ]
        };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.FetchNearestAddressAsync(-36.8509, 174.7645);

        // Assert
        Assert.Single(result);
        Assert.Equal("Nearest Address", result[0].Address.Label);
    }

    [Fact]
    public async Task FetchNearestAddressAsync_NoResults_ReturnsEmptyList()
    {
        // Arrange
        var response = new HereMapsAutocompleteResponse { Items = null };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.FetchNearestAddressAsync(0, 0);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task FetchNearestAddressAsync_HttpError_ThrowsException()
    {
        // Arrange
        SetupHttpError(HttpStatusCode.ServiceUnavailable);
        var service = CreateService();

        // Assert
        await Assert.ThrowsAsync<HttpRequestException>((Func<Task<IReadOnlyList<HereMapsLocationResult>>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<IReadOnlyList<HereMapsLocationResult>> Act() => await service.FetchNearestAddressAsync(-36.8509, 174.7645);
    }

    private void SetupHttpResponse<T>(T responseObject)
    {
        var jsonResponse = JsonSerializer.Serialize(responseObject);
        _httpHandler.SetResponse(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(jsonResponse)
        });
    }

    private void SetupHttpError(HttpStatusCode statusCode)
    {
        _httpHandler.SetResponse(new HttpResponseMessage(statusCode));
    }

}
