using System.Net;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for RateJobService methods: RateJobNzAsync, RateJobUsAsync, GetJobRateNzAsync, GetJobRateUsAsync,
/// and related helpers. Bulk price tests are covered in RateJobServiceBulkPriceTests.
/// </summary>
public class RateJobServiceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock = new();
    private readonly Mock<IJobReportService> _jobReportServiceMock = new();
    private readonly Mock<IPricingPermissionService> _pricingPermissionServiceMock = new();

    public RateJobServiceTests()
    {
        // By default, allow all job access in tests (internal user behavior)
        _pricingPermissionServiceMock
            .Setup(x => x.ValidateJobsAccessAsync(It.IsAny<List<int>>()))
            .ReturnsAsync([]);

        // Default: US tenant
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);

        // Set required environment variable for HERE Maps API calls
        Environment.SetEnvironmentVariable("HereMapsAPIKey", "test-api-key");
    }

    private RateJobService CreateService(HttpClient? httpClient = null) => new(
        _jobRepositoryMock.Object,
        httpClient ?? new HttpClient(),
        _tenantInfoServiceMock.Object,
        _httpContextAccessorMock.Object,
        _jobReportServiceMock.Object,
        _pricingPermissionServiceMock.Object
    );

    #region MockHttpMessageHandler

    private static HttpClient CreateMockHttpClient(HttpStatusCode statusCode, string content)
    {
        var handler = new MockHttpMessageHandler(statusCode, content);
        return new HttpClient(handler) { BaseAddress = new Uri("https://router.hereapi.com") };
    }

    private class MockHttpMessageHandler(HttpStatusCode statusCode, string content) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(content, System.Text.Encoding.UTF8, "application/json")
            });
    }

    #endregion

    #region RateJobNzAsync - Validation Tests

    [Fact]
    public async Task RateJobNzAsync_NullJobDetails_ThrowsArgumentNullException()
    {
        var service = CreateService();

        var act = () => service.RateJobNzAsync(null!);

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task RateJobNzAsync_NullClientId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(clientId: null);

        var act = () => service.RateJobNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ClientId"));
    }

    [Fact]
    public async Task RateJobNzAsync_NullFromId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(fromId: null);

        var act = () => service.RateJobNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("FromId"));
    }

    [Fact]
    public async Task RateJobNzAsync_NullToId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(toId: null);

        var act = () => service.RateJobNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ToId"));
    }

    [Fact]
    public async Task RateJobNzAsync_NullSpeedId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(speedId: null);

        var act = () => service.RateJobNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SpeedId"));
    }

    [Fact]
    public async Task RateJobNzAsync_NullSizeId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(sizeId: null);

        var act = () => service.RateJobNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SizeId"));
    }

    #endregion

    #region RateJobUsAsync - Validation Tests

    [Fact]
    public async Task RateJobUsAsync_NullJobDetails_ThrowsArgumentNullException()
    {
        var service = CreateService();

        var act = () => service.RateJobUsAsync(null!);

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task RateJobUsAsync_NullSpeedId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(speedId: null);

        var act = () => service.RateJobUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SpeedId"));
    }

    [Fact]
    public async Task RateJobUsAsync_NullClientId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(clientId: null);

        var act = () => service.RateJobUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ClientId"));
    }

    [Fact]
    public async Task RateJobUsAsync_NullSizeId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(sizeId: null);

        var act = () => service.RateJobUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SizeId"));
    }

    #endregion

    #region RateJobUsAsync - Road Distance Tests (Non-Flight)

    [Fact]
    public async Task RateJobUsAsync_NonFlightSpeed_CallsRateJobUsWithTotalMiles()
    {
        // Arrange - non-flight speed (GroupingId = 1, which is SpeedGrouping.Excelerator)
        const string hereResponse = """{"routes":[{"sections":[{"transport":{"mode":"car"},"summary":{"length":16093}}]}]}""";
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        _jobRepositoryMock.Verify(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()), Times.Once);
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(10m); // 16093 meters / 1609.344 = ~10 miles
        capturedDto.FromMiles.Should().Be(0m); // Non-flight should not have FromMiles
        capturedDto.ToMiles.Should().Be(0m); // Non-flight should not have ToMiles
        capturedDto.ClientId.Should().Be(jobDetails.ClientId!.Value);
        capturedDto.Speed.Should().Be(jobDetails.SpeedId!.Value);
        capturedDto.Size.Should().Be(jobDetails.SizeId!.Value);
        capturedDto.JobId.Should().Be(jobDetails.JobId);
    }

    [Fact]
    public async Task RateJobUsAsync_NonFlightSpeed_ZeroCoordinates_ReturnsTotalMilesZero()
    {
        // Arrange - zero coordinates bypass the HTTP call and return 0 miles
        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails(pickupLat: 0, pickupLong: 0, deliveryLat: 0, deliveryLong: 0);

        var service = CreateService();

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(0m);
    }

    [Fact]
    public async Task RateJobUsAsync_NonFlightSpeed_MultipleSections_SumsCarTransportOnly()
    {
        // Arrange - multiple sections, only car mode sections should be summed
        const string hereResponse = """
                                    {
                                        "routes": [{
                                            "sections": [
                                                {"transport": {"mode": "car"}, "summary": {"length": 16093}},
                                                {"transport": {"mode": "pedestrian"}, "summary": {"length": 5000}},
                                                {"transport": {"mode": "car"}, "summary": {"length": 16093}}
                                            ]
                                        }]
                                    }
                                    """;
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert - only car sections summed: 16093 + 16093 = 32186 meters = ~20 miles
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(20m);
    }

    [Fact]
    public async Task RateJobUsAsync_NonFlightSpeed_MapsAllFieldsCorrectly()
    {
        // Arrange
        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = new JobRatingDetailsDto
        {
            JobId = 42,
            ClientId = 10,
            SpeedId = 1,
            SizeId = 3,
            PickupLat = 0, // Zero coords to avoid HTTP call
            PickupLong = 0,
            DeliveryLat = 0,
            DeliveryLong = 0,
            FromZip = "10001",
            ToZip = "90210",
            Weight = 25.5,
            BookedDate = new DateTime(2026, 1, 15),
            DangerousGoods = true,
            TotalPallets = 2,
            ExtraStopOffs = 1,
            DryIceWeight = 5m,
            WaitTime = 30,
            Quantity = 3,
            Cubic = 1.5m,
            IsPrebook = true,
            CalculateDimsOncePerJob = true,
            PreviousRate = 150.50m
        };

        var service = CreateService();

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.JobId.Should().Be(42);
        capturedDto.ClientId.Should().Be(10);
        capturedDto.Speed.Should().Be(1);
        capturedDto.Size.Should().Be(3);
        capturedDto.FromZip.Should().Be("10001");
        capturedDto.ToZip.Should().Be("90210");
        capturedDto.Weight.Should().Be(25); // cast to int
        capturedDto.Booked.Should().Be(new DateTime(2026, 1, 15));
        capturedDto.DangerousGoods.Should().BeTrue();
        capturedDto.TotalPallets.Should().Be(2);
        capturedDto.ExtraStopOffs.Should().Be(1);
        capturedDto.DryIceWeight.Should().Be(5);
        capturedDto.WaitTime.Should().Be(30);
        capturedDto.Quantity.Should().Be(3);
        capturedDto.Cubic.Should().Be(1.5m);
        capturedDto.IsPrebook.Should().BeTrue();
        capturedDto.CalculateDimsOncePerJob.Should().BeTrue();
        capturedDto.PreviousRate.Should().Be(150.50m);
    }

    #endregion

    #region RateJobUsAsync - Flight Speed Tests

    [Fact]
    public async Task RateJobUsAsync_FlightSpeed_GetsClosestAirportsAndCalculatesFromToMiles()
    {
        // Arrange - flight speed (GroupingId = 2 for US = SpeedGrouping.Flight)
        const string hereResponse = """{"routes":[{"sections":[{"transport":{"mode":"car"},"summary":{"length":8046}}]}]}""";
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupFlightSpeed();

        var fromAirport = new AddressWithAgent
        {
            AirportId = 100, AgentId = 200,
            Latitude = 40.6413m, Longitude = -73.7781m,
            AirportCode = "JFK", City = "New York", State = "NY",
            StreetAddress = "JFK Airport"
        };
        var toAirport = new AddressWithAgent
        {
            AirportId = 101, AgentId = 201,
            Latitude = 33.9425m, Longitude = -118.4081m,
            AirportCode = "LAX", City = "Los Angeles", State = "CA",
            StreetAddress = "LAX Airport"
        };

        _jobRepositoryMock.Setup(x => x.GetClosestAirportsAsync(40.7128m, -74.0060m))
            .ReturnsAsync([fromAirport]);
        _jobRepositoryMock.Setup(x => x.GetClosestAirportsAsync(34.0522m, -118.2437m))
            .ReturnsAsync([toAirport]);

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails(speedId: 2, deliveryLat: 34.0522m, deliveryLong: -118.2437m);

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert - flight path calculates FromMiles and ToMiles separately
        _jobRepositoryMock.Verify(x => x.GetClosestAirportsAsync(40.7128m, -74.0060m), Times.Once);
        _jobRepositoryMock.Verify(x => x.GetClosestAirportsAsync(34.0522m, -118.2437m), Times.Once);

        capturedDto.Should().NotBeNull();
        capturedDto!.FromMiles.Should().Be(5m); // 8046 meters / 1609.344 = ~5 miles
        capturedDto.ToMiles.Should().Be(5m); // Same mock response for both calls
        capturedDto.TotalMiles.Should().Be(0m); // Flight jobs do not set TotalMiles
        capturedDto.FromAirportId.Should().Be(100);
        capturedDto.ToAirportId.Should().Be(101);
        capturedDto.FromAgentId.Should().Be(200);
        capturedDto.ToAgentId.Should().Be(201);
    }

    [Fact]
    public async Task RateJobUsAsync_FlightSpeed_ZeroCoordinates_ReturnsZeroMiles()
    {
        // Arrange - flight speed with zero coords means airports are looked up with 0,0
        SetupFlightSpeed();

        var airport = new AddressWithAgent
        {
            AirportId = 1, AgentId = 1,
            Latitude = 0m, Longitude = 0m,
            AirportCode = "TST", City = "Test", State = "TS",
            StreetAddress = "Test"
        };

        _jobRepositoryMock.Setup(x => x.GetClosestAirportsAsync(It.IsAny<decimal>(), It.IsAny<decimal>()))
            .ReturnsAsync([airport]);

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails(speedId: 2, pickupLat: 0, pickupLong: 0, deliveryLat: 0, deliveryLong: 0);

        var service = CreateService();

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert - zero coords return 0 miles for both legs
        capturedDto.Should().NotBeNull();
        capturedDto!.FromMiles.Should().Be(0m);
        capturedDto.ToMiles.Should().Be(0m);
    }

    #endregion

    #region GetJobRateNzAsync Tests

    [Fact]
    public async Task GetJobRateNzAsync_NullJobDetails_ThrowsArgumentNullException()
    {
        var service = CreateService();

        var act = () => service.GetJobRateNzAsync(null!);

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task GetJobRateNzAsync_NullClientId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(clientId: null);

        var act = () => service.GetJobRateNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ClientId"));
    }

    [Fact]
    public async Task GetJobRateNzAsync_NullFromId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(fromId: null);

        var act = () => service.GetJobRateNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("FromId"));
    }

    [Fact]
    public async Task GetJobRateNzAsync_NullToId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(toId: null);

        var act = () => service.GetJobRateNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ToId"));
    }

    [Fact]
    public async Task GetJobRateNzAsync_NullSpeedId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(speedId: null);

        var act = () => service.GetJobRateNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SpeedId"));
    }

    [Fact]
    public async Task GetJobRateNzAsync_NullSizeId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidNzJobDetails(sizeId: null);

        var act = () => service.GetJobRateNzAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SizeId"));
    }

    #endregion

    #region GetJobRateUsAsync Tests

    [Fact]
    public async Task GetJobRateUsAsync_NullJobDetails_ThrowsArgumentNullException()
    {
        var service = CreateService();

        var act = () => service.GetJobRateUsAsync(null!);

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task GetJobRateUsAsync_NullSpeedId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(speedId: null);

        var act = () => service.GetJobRateUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SpeedId"));
    }

    [Fact]
    public async Task GetJobRateUsAsync_NullClientId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(clientId: null);

        var act = () => service.GetJobRateUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("ClientId"));
    }

    [Fact]
    public async Task GetJobRateUsAsync_NullSizeId_ThrowsArgumentNullException()
    {
        var service = CreateService();
        var jobDetails = CreateValidUsJobDetails(sizeId: null);

        var act = () => service.GetJobRateUsAsync(jobDetails);

        await act.Should().ThrowAsync<ArgumentNullException>()
            .Where(ex => ex.ParamName == "jobDetails" && ex.Message.Contains("SizeId"));
    }

    [Fact]
    public async Task GetJobRateUsAsync_ValidJob_ReturnsRateFromRepository()
    {
        // Arrange
        SetupNonFlightSpeed();

        _jobRepositoryMock.Setup(x => x.GetJobRateUsAsync(It.IsAny<RateJobUsDto>()))
            .ReturnsAsync(250.75m);

        var jobDetails = CreateValidUsJobDetails(pickupLat: 0, pickupLong: 0, deliveryLat: 0, deliveryLong: 0);

        var service = CreateService();

        // Act
        var rate = await service.GetJobRateUsAsync(jobDetails);

        // Assert
        rate.Should().Be(250.75m);
        _jobRepositoryMock.Verify(x => x.GetJobRateUsAsync(It.IsAny<RateJobUsDto>()), Times.Once);
    }

    [Fact]
    public async Task GetJobRateUsAsync_ValidJob_PassesCorrectFieldsToRepository()
    {
        // Arrange
        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.GetJobRateUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .ReturnsAsync(100m);

        var jobDetails = new JobRatingDetailsDto
        {
            JobId = 99,
            ClientId = 5,
            SpeedId = 1,
            SizeId = 2,
            PickupLat = 0,
            PickupLong = 0,
            DeliveryLat = 0,
            DeliveryLong = 0,
            FromZip = "30301",
            ToZip = "60601",
            Weight = 10.0,
            Quantity = 2,
            Cubic = 0.5m,
            IsPrebook = false,
            DangerousGoods = false,
            BookedDate = new DateTime(2026, 6, 1)
        };

        var service = CreateService();

        // Act
        await service.GetJobRateUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.JobId.Should().Be(99);
        capturedDto.ClientId.Should().Be(5);
        capturedDto.Speed.Should().Be(1);
        capturedDto.Size.Should().Be(2);
        capturedDto.FromZip.Should().Be("30301");
        capturedDto.ToZip.Should().Be("60601");
        capturedDto.Weight.Should().Be(10);
        capturedDto.Quantity.Should().Be(2);
        capturedDto.Cubic.Should().Be(0.5m);
        capturedDto.IsPrebook.Should().BeFalse();
    }

    #endregion

    #region CalculateMilesFromRoute (Indirect Tests via RateJobUsAsync)

    [Fact]
    public async Task RateJobUsAsync_EmptyRouteSections_ReturnsTotalMilesZero()
    {
        // Arrange - route response with no sections
        var hereResponse = """{"routes":[{"sections":[]}]}""";
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(0m);
    }

    [Fact]
    public async Task RateJobUsAsync_NullRoutesInResponse_ReturnsTotalMilesZero()
    {
        // Arrange - route response with null routes
        const string hereResponse = """{"routes":null}""";
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(0m);
    }

    [Fact]
    public async Task RateJobUsAsync_EmptyRoutesArray_ReturnsTotalMilesZero()
    {
        // Arrange
        const string hereResponse = """{"routes":[]}""";
        var httpClient = CreateMockHttpClient(HttpStatusCode.OK, hereResponse);

        SetupNonFlightSpeed();

        RateJobUsDto? capturedDto = null;
        _jobRepositoryMock.Setup(x => x.RateJobUsAsync(It.IsAny<RateJobUsDto>()))
            .Callback<RateJobUsDto>(dto => capturedDto = dto)
            .Returns(Task.CompletedTask);

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        await service.RateJobUsAsync(jobDetails);

        // Assert
        capturedDto.Should().NotBeNull();
        capturedDto!.TotalMiles.Should().Be(0m);
    }

    #endregion

    #region Bulk Update - Void Field Handling

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_JobsWithVoidTrue_CallsUpdateJobVoidStatusAsync()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m, Void = true },
                new JobManualPriceModel { Id = 2, Amount = 200m, Void = true }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 50m },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 100m }
            });

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        _jobRepositoryMock.Verify(x => x.UpdateJobVoidStatusAsync(
            It.Is<List<int>>(ids => ids.Count == 2 && ids.Contains(1) && ids.Contains(2))), Times.Once);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_NoVoidJobs_DoesNotCallUpdateJobVoidStatusAsync()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m, Void = false },
                new JobManualPriceModel { Id = 2, Amount = 200m, Void = null }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 50m },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 100m }
            });

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        _jobRepositoryMock.Verify(x => x.UpdateJobVoidStatusAsync(It.IsAny<List<int>>()), Times.Never);
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_MixedVoidAndNonVoid_OnlyVoidsMarkedJobs()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m, Void = true },
                new JobManualPriceModel { Id = 2, Amount = 200m, Void = false },
                new JobManualPriceModel { Id = 3, Amount = 300m, Void = true }
            ]);

        _jobRepositoryMock.Setup(x => x.GetJobCurrentAmountsAsync(It.IsAny<List<int>>()))
            .ReturnsAsync(new Dictionary<int, JobCurrentAmountInfo>
            {
                [1] = new() { JobId = 1, JobNo = "JOB-001", Amount = 50m },
                [2] = new() { JobId = 2, JobNo = "JOB-002", Amount = 100m },
                [3] = new() { JobId = 3, JobNo = "JOB-003", Amount = 150m }
            });

        var service = CreateService();

        // Act
        await service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        _jobRepositoryMock.Verify(x => x.UpdateJobVoidStatusAsync(
            It.Is<List<int>>(ids => ids.Count == 2 && ids.Contains(1) && ids.Contains(3) && !ids.Contains(2))),
            Times.Once);
    }

    #endregion

    #region Bulk Update - Access Control

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_InaccessibleJobs_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m },
                new JobManualPriceModel { Id = 2, Amount = 200m }
            ]);

        // Return inaccessible job IDs
        _pricingPermissionServiceMock
            .Setup(x => x.ValidateJobsAccessAsync(It.IsAny<List<int>>()))
            .ReturnsAsync([1, 2]);

        var service = CreateService();

        // Act
        var act = () => service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("*do not have access*");
    }

    [Fact]
    public async Task ApplyBulkPriceUpdateAsync_SomeInaccessibleJobs_ThrowsWithJobList()
    {
        // Arrange
        var fileMock = CreateMockFile("test.csv", string.Empty);
        _jobReportServiceMock.Setup(x => x.ParseBulkPriceFileAsync(fileMock.Object))
            .ReturnsAsync([
                new JobManualPriceModel { Id = 1, Amount = 100m },
                new JobManualPriceModel { Id = 2, Amount = 200m },
                new JobManualPriceModel { Id = 3, Amount = 300m }
            ]);

        // Only job 2 is inaccessible
        _pricingPermissionServiceMock
            .Setup(x => x.ValidateJobsAccessAsync(It.IsAny<List<int>>()))
            .ReturnsAsync([2]);

        var service = CreateService();

        // Act
        var act = () => service.ApplyBulkPriceUpdateAsync(fileMock.Object, "gross");

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("*2*");
    }

    #endregion

    #region RateJobUsAsync - API Failure

    [Fact]
    public async Task RateJobUsAsync_HereMapsApiFailure_ThrowsApplicationException()
    {
        // Arrange - HTTP 500 from HERE Maps
        var httpClient = CreateMockHttpClient(HttpStatusCode.InternalServerError, "Server Error");

        SetupNonFlightSpeed();

        var jobDetails = CreateValidUsJobDetails();

        var service = CreateService(httpClient);

        // Act
        var act = () => service.RateJobUsAsync(jobDetails);

        // Assert - exception propagates
        await act.Should().ThrowAsync<ApplicationException>();
    }

    #endregion

    #region Helper Methods

    private static JobRatingDetailsDtoNz CreateValidNzJobDetails(
        int? clientId = 10, int? fromId = 100, int? toId = 200, int? speedId = 1, int? sizeId = 1) => new()
    {
        JobId = 1,
        ClientId = clientId,
        FromId = fromId,
        ToId = toId,
        SpeedId = speedId,
        SizeId = sizeId,
        JobType = JobType.Active,
        PickupLat = -36.8485m,
        PickupLong = 174.7633m,
        DeliveryLat = -36.8509m,
        DeliveryLong = 174.7645m,
        Quantity = 1,
        Weight = 5.0
    };

    private static JobRatingDetailsDto CreateValidUsJobDetails(
        int? clientId = 10, int? speedId = 1, int? sizeId = 1,
        decimal pickupLat = 40.7128m, decimal pickupLong = -74.0060m,
        decimal deliveryLat = 40.7580m, decimal deliveryLong = -73.9855m) => new()
    {
        JobId = 1,
        ClientId = clientId,
        SpeedId = speedId,
        SizeId = sizeId,
        PickupLat = pickupLat,
        PickupLong = pickupLong,
        DeliveryLat = deliveryLat,
        DeliveryLong = deliveryLong,
        FromZip = "10001",
        ToZip = "10019",
        Weight = 5.0,
        Quantity = 1,
        BookedDate = new DateTime(2026, 1, 1)
    };

    private void SetupNonFlightSpeed() =>
        _jobRepositoryMock.Setup(x => x.GetJobTypeByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new TucJobType
            {
                UcjtId = 1,
                UcjtName = "Same Day",
                Grouping = new TucJobTypeGrouping { GroupingId = 1, GroupingName = "Standard" }
            });

    private void SetupFlightSpeed() =>
        _jobRepositoryMock.Setup(x => x.GetJobTypeByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(new TucJobType
            {
                UcjtId = 2,
                UcjtName = "Flight",
                Grouping = new TucJobTypeGrouping { GroupingId = (int)SpeedGrouping.Flight, GroupingName = "Flight" }
            });

    private static Mock<IFormFile> CreateMockFile(string fileName, string content)
    {
        var fileMock = new Mock<IFormFile>();
        var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

        fileMock.Setup(f => f.FileName).Returns(fileName);
        fileMock.Setup(f => f.Length).Returns(stream.Length);
        fileMock.Setup(f => f.OpenReadStream()).Returns(stream);
        fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Callback<Stream, CancellationToken>((s, _) => stream.CopyTo(s))
            .Returns(Task.CompletedTask);

        return fileMock;
    }

    #endregion
}
