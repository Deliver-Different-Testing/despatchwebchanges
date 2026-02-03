using System.Net;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;
using Moq.Protected;

// Alias for HereMaps Address which is just called Address in the Models
using HereMapsAddress = DespatchWeb.Models.Address;
using HereMapsPosition = DespatchWeb.Models.Position;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddressLookupService - tests HERE Maps API integration for address lookup.
/// </summary>
public class AddressLookupServiceTests
{
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<HttpMessageHandler> _httpHandlerMock = new();

    public AddressLookupServiceTests()
    {
        // Set required environment variable for HERE Maps API
        Environment.SetEnvironmentVariable("HereMapsAPIKey", "test-api-key");
    }

    private AddressLookupService CreateService()
    {
        var httpClient = new HttpClient(_httpHandlerMock.Object);
        return new AddressLookupService(httpClient, _tenantInfoServiceMock.Object);
    }

    #region AutocompleteAddressSearchAsync Validation Tests

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
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_TextTooShort_ReturnsEmptyList()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.AutocompleteAddressSearchAsync("12");

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region AutocompleteAddressSearchAsync API Tests

    [Fact]
    public async Task AutocompleteAddressSearchAsync_UsCustomer_SendsUsaCountryCode()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        SetupHttpResponse(new HereMapsAutocompleteResponse { Items = [] });
        var service = CreateService();

        // Act
        await service.AutocompleteAddressSearchAsync("123 Main");

        // Assert
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null && req.RequestUri.ToString().Contains("countryCode%3AUSA")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_NzCustomer_SendsNzlCountryCode()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        SetupHttpResponse(new HereMapsAutocompleteResponse { Items = [] });
        var service = CreateService();

        // Act
        await service.AutocompleteAddressSearchAsync("123 Main");

        // Assert
        _httpHandlerMock.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri != null && req.RequestUri.ToString().Contains("countryCode%3ANZL")),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_ValidResponse_ReturnsResults()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
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
        result.Should().HaveCount(2);
        result[0].Address.Label.Should().Be("123 Main St, New York, NY");
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_FiltersCategoryQueries()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
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
        result.Should().HaveCount(1);
        result[0].Address.Label.Should().Be("Valid Address");
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_FiltersNullAddressLabels()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
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
        result.Should().HaveCount(1);
    }

    [Fact]
    public async Task AutocompleteAddressSearchAsync_HttpError_ThrowsException()
    {
        // Arrange
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);
        SetupHttpError(HttpStatusCode.InternalServerError);
        var service = CreateService();

        // Act
        var act = async () => await service.AutocompleteAddressSearchAsync("test");

        // Assert
        await act.Should().ThrowAsync<HttpRequestException>();
    }

    #endregion

    #region GetLocationDetailsByIdAsync Tests

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
        result.Should().NotBeNull();
        result.Address.Label.Should().Be("123 Main St, Auckland");
    }

    [Fact]
    public async Task GetLocationDetailsByIdAsync_HttpError_ThrowsException()
    {
        // Arrange
        SetupHttpError(HttpStatusCode.NotFound);
        var service = CreateService();

        // Act
        var act = async () => await service.GetLocationDetailsByIdAsync("invalid-id");

        // Assert
        await act.Should().ThrowAsync<HttpRequestException>();
    }

    #endregion

    #region FetchNearestAddressAsync Tests

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
                    Address = new HereMapsAddress { Label = "Nearest Address" },
                    Position = new HereMapsPosition { Lat = -36.8509, Lng = 174.7645 }
                }
            ]
        };
        SetupHttpResponse(response);
        var service = CreateService();

        // Act
        var result = await service.FetchNearestAddressAsync(-36.8509, 174.7645);

        // Assert
        result.Should().HaveCount(1);
        result[0].Address.Label.Should().Be("Nearest Address");
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
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task FetchNearestAddressAsync_HttpError_ThrowsException()
    {
        // Arrange
        SetupHttpError(HttpStatusCode.ServiceUnavailable);
        var service = CreateService();

        // Act
        var act = async () => await service.FetchNearestAddressAsync(-36.8509, 174.7645);

        // Assert
        await act.Should().ThrowAsync<HttpRequestException>();
    }

    #endregion

    #region Helper Methods

    private void SetupHttpResponse<T>(T responseObject)
    {
        var jsonResponse = JsonSerializer.Serialize(responseObject);
        var httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(jsonResponse)
        };

        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(httpResponse);
    }

    private void SetupHttpError(HttpStatusCode statusCode)
    {
        var httpResponse = new HttpResponseMessage(statusCode);

        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(httpResponse);
    }

    #endregion
}
