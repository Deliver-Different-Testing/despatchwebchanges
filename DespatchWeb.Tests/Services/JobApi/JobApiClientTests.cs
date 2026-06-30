using System.Security.Claims;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services.JobApi;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services.JobApi;

public class JobApiClientTests
{
    private readonly IDespatchApiClient _despatchApi = Substitute.For<IDespatchApiClient>();
    private readonly IHttpContextAccessor _httpContextAccessor = Substitute.For<IHttpContextAccessor>();

    private void SetTenantCountry(string countryCode)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, "testuser"),
            new("Connection", "TestConnection"),
            new("CurrentTenantID", "1"),
            new("TimeZone", "Pacific/Auckland"),
            new("ContactID", "99")
        };
        if (countryCode is not null)
        {
            claims.Add(new Claim("CountryCode", countryCode));
        }

        var user = new ClaimsPrincipal(new ClaimsIdentity(claims));
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext { User = user });
    }

    public JobApiClientTests()
    {
        SetTenantCountry("NZ");
    }

    private JobApiClient CreateClient() => new(_despatchApi, _httpContextAccessor);

    // Address lines follow the frontend's documented semantics:
    // L1 company, L3 street number, L4 street name, L5 city(US)/suburb(NZ),
    // L6 state(US)/city(NZ), L7 zip(US)/postcode(NZ), L8 country NAME (free-form notes).
    private static JobCreateViewModel SampleRequest(decimal? weightKg = null, decimal? weightLb = null, int? vehicleId = null) => new()
    {
        ClientId = 42,
        SpeedId = 7,
        VehicleId = vehicleId,
        FromContactName = "Alice",
        DeliverToContact = "Bob",
        PickUpAddress = new AddressViewModel { AddressLine1 = "Acme Co", AddressLine3 = "12", AddressLine4 = "Main St", AddressLine5 = "Ponsonby", AddressLine6 = "Auckland", AddressLine7 = "1011", AddressLine8 = "New Zealand", Latitude = -36.84m, Longitude = 174.76m },
        DeliveryAddress = new AddressViewModel { AddressLine1 = "Beta Co", AddressLine3 = "34", AddressLine4 = "High St", AddressLine5 = "Te Aro", AddressLine6 = "Wellington", AddressLine7 = "6011", AddressLine8 = "New Zealand" },
        Date = new DateTimeOffset(2026, 5, 20, 9, 0, 0, TimeSpan.Zero),
        RefA = "RA-1",
        RefB = "RB-2",
        JobNotes = "Handle with care",
        Charge = 25.50m,
        WeightKg = weightKg,
        WeightLb = weightLb
    };

    private static JobCreateViewModel UsSampleRequest() => new()
    {
        ClientId = 42,
        SpeedId = 7,
        FromContactName = "Alice",
        DeliverToContact = "Bob",
        PickUpAddress = new AddressViewModel { AddressLine1 = "Acme Co", AddressLine3 = "500", AddressLine4 = "Market St", AddressLine5 = "San Francisco", AddressLine6 = "California", AddressLine7 = "94105", AddressLine8 = "United States" },
        DeliveryAddress = new AddressViewModel { AddressLine1 = "Beta Co", AddressLine3 = "1", AddressLine4 = "Apple Park Way", AddressLine5 = "Cupertino", AddressLine6 = "California", AddressLine7 = "95014", AddressLine8 = "United States" },
        Date = new DateTimeOffset(2026, 5, 20, 9, 0, 0, TimeSpan.Zero),
        Charge = 25.50m,
        WeightLb = 11m
    };

    [Fact]
    public async Task QuickCreateAsync_OkResponse_ReturnsJobId()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 123, JobNumber = "JOB-001" });

        var jobId = await CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken);

        Assert.Equal(123, jobId);
    }

    [Fact]
    public async Task QuickCreateAsync_ForwardsTenantContextFromClaims()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken);

        await _despatchApi.Received(1).BookPickupAsync(
            tenantId: 1,
            connection: "TestConnection",
            timeZone: "Pacific/Auckland",
            clientId: 42,
            contactId: 99,
            Arg.Any<BookPickupDto>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task QuickCreateAsync_MapsJobCreateViewModelToBookPickupDto()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Equal(7, captured.SpeedId);
        Assert.Equal("7", captured.QuoteId);
        Assert.Equal("RA-1", captured.ClientReferenceA);
        Assert.Equal("RB-2", captured.ClientReferenceB);
        Assert.Equal("Handle with care", captured.ClientNotes);
        Assert.Equal(25.50m, captured.FixedAmount);
        Assert.True(captured.IsSignatureRequired);
        Assert.Equal("Alice", captured.Pickup.ContactPerson);
        Assert.Equal("12 Main St", captured.Pickup.From.StreetAddress);
        Assert.Equal("Bob", captured.Delivery.ContactPerson);
        Assert.Equal("34 High St", captured.Delivery.To.StreetAddress);
        Assert.Single(captured.Packages);
        Assert.Equal(1, captured.Packages[0].Units);
    }

    [Fact]
    public async Task QuickCreateAsync_NzTenant_MapsAddressLinesToNzFields()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        var from = captured.Pickup.From;
        // ISO-2 country comes from the tenant claim, NOT the free-form country name in AddressLine8.
        Assert.Equal("NZ", from.CountryCode);
        Assert.Equal("Ponsonby", from.Suburb);
        Assert.Equal("Auckland", from.City);
        Assert.Equal("1011", from.PostCode);
        Assert.Null(from.State);
        Assert.Null(from.ZipCode);
    }

    [Fact]
    public async Task QuickCreateAsync_UsTenant_MapsAddressLinesToUsFields()
    {
        SetTenantCountry("US");
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(UsSampleRequest(), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        var from = captured.Pickup.From;
        Assert.Equal("US", from.CountryCode);
        Assert.Equal("San Francisco", from.City);
        Assert.Equal("California", from.State);
        Assert.Equal("94105", from.ZipCode);
        Assert.Null(from.Suburb);
        Assert.Null(from.PostCode);
    }

    [Fact]
    public async Task QuickCreateAsync_VehicleId_MapsToVehicleSizeId()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(vehicleId: 3), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Equal(3, captured.VehicleSizeId);
    }

    [Fact]
    public async Task QuickCreateAsync_NoVehicleId_LeavesVehicleSizeIdNull()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Null(captured.VehicleSizeId);
    }

    [Fact]
    public async Task QuickCreateAsync_WeightKg_MapsToPackageKg()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(weightKg: 5m), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Single(captured.Packages);
        Assert.Equal(5m, captured.Packages[0].Kg);
        Assert.Null(captured.Packages[0].Lb);
    }

    [Fact]
    public async Task QuickCreateAsync_WeightLb_MapsToPackageLb()
    {
        BookPickupDto? captured = null;
        _despatchApi.BookPickupAsync(
                Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
                Arg.Do<BookPickupDto>(d => captured = d), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobId = 1 });

        await CreateClient().QuickCreateAsync(SampleRequest(weightLb: 11m), TestContext.Current.CancellationToken);

        Assert.NotNull(captured);
        Assert.Single(captured.Packages);
        Assert.Equal(11m, captured.Packages[0].Lb);
        Assert.Null(captured.Packages[0].Kg);
    }

    [Fact]
    public async Task QuickCreateAsync_ResponseTransportError_Throws()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { Error = new ErrorDto { Message = "500 InternalServerError" } });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken));
        Assert.Contains("500", ex.Message);
    }

    [Fact]
    public async Task QuickCreateAsync_ResponseValidationErrors_Throws()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto
            {
                Errors = [new ErrorInfoDto { Property = "Pickup.From.City", Message = "Required" }]
            });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken));
        Assert.Contains("Pickup.From.City", ex.Message);
        Assert.Contains("Required", ex.Message);
    }

    [Fact]
    public async Task QuickCreateAsync_MissingJobId_Throws()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .Returns(new JobResponseDto { JobNumber = "JOB-001" });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task QuickCreateAsync_MissingClaims_Throws()
    {
        var emptyUser = new ClaimsPrincipal(new ClaimsIdentity());
        _httpContextAccessor.HttpContext.Returns(new DefaultHttpContext { User = emptyUser });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task QuickCreateAsync_NullRequest_Throws()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            CreateClient().QuickCreateAsync(null, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task QuickCreateAsync_BubblesUpDownstreamException()
    {
        _despatchApi.BookPickupAsync(
            Arg.Any<int>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<int>(),
            Arg.Any<BookPickupDto>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("network down"));

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            CreateClient().QuickCreateAsync(SampleRequest(), TestContext.Current.CancellationToken));
    }
}
