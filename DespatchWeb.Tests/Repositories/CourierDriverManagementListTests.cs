using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Driver management lists: compliance (one row per item), after-hours and today-active sorting.
/// Clock is fixed at 2024-01-15 10:00.
/// </summary>
public class CourierDriverManagementListTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly ITenantInfoService _tenantInfo = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 1, 15, 10, 0, 0));

    public CourierDriverManagementListTests()
    {
        _tenantInfo.GetTenantTimeZone().Returns("New Zealand Standard Time");
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        _cache.Dispose();
        await _db.DisposeAsync();
    }

    private CourierRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        _tenantInfo,
        _clock,
        Substitute.For<IClearListEnvelopeService>(),
        _cache);

    private static TucCourier Courier(int id, string code, string first, string last, int fleet = 1,
        bool active = true, Action<TucCourier>? configure = null)
    {
        var courier = new TucCourier
        {
            UccrId = id, Code = code, UccrName = first, UccrSurname = last, Active = active,
            CourierFleetId = fleet, UccrChannelId = 1, VehiclePlateNnumber = "ABC123",
            Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
        };
        configure?.Invoke(courier);
        return courier;
    }

    private async Task SeedAsync(params object[] entities)
    {
        await using var context = _db.CreateContext();
        context.AddRange(entities);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucCourierFleet Fleet(int id, string name) => new()
    {
        UccfId = id, UccfName = name,
        Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
    };

    // ---------------------------------------------------------------- compliance

    /// <summary>
    /// Aroha (DG): licence 14 Jan (expired, -1d), DG 26 Feb (+42d, expiring), WOF none, rego 2025 (valid).
    /// Ben (no DG): licence 15 Jan (+0d, expiring), WOF 27 Feb (+43d, valid), rego 1 Jan (expired, -14d).
    /// Inactive driver must never appear.
    /// </summary>
    private Task SeedComplianceAsync() => SeedAsync(
        Courier(1, "A01", "Aroha", "Ngata", 1, configure: c =>
        {
            c.UccrDangerousGoods = 1;
            c.DriversLicenseExpiry = new DateTime(2024, 1, 14, 18, 30, 0);
            c.DglicenseExpiry = new DateTime(2024, 2, 26);
            c.Wofexpiry = null;
            c.RegistrationExpiry = new DateTime(2025, 1, 1);
        }),
        Courier(2, "B02", "Ben", "Hill", 2, configure: c =>
        {
            c.UccrDangerousGoods = 0;
            c.DriversLicenseExpiry = new DateTime(2024, 1, 15);
            c.DglicenseExpiry = new DateTime(2020, 1, 1);
            c.Wofexpiry = new DateTime(2024, 2, 27);
            c.RegistrationExpiry = new DateTime(2024, 1, 1);
        }),
        Courier(3, "Z99", "Gone", "Away", 1, active: false, configure: c =>
            c.DriversLicenseExpiry = new DateTime(2020, 1, 1)));

    private static CourierComplianceFilterRequest Req(string? type = null, string? status = null,
        string? orderBy = null, bool desc = false, int page = 1, int pageSize = 50, int fleet = 0,
        string? search = null) => new()
    {
        Type = type!, Status = status!, OrderBy = orderBy!, SortDescending = desc, Page = page,
        PageSize = pageSize, Fleet = fleet, SearchTerm = search!
    };

    private static string Id(CourierComplianceViewModel i) => $"{i.Code}:{i.ComplianceTypeKey}";

    [Fact]
    public async Task Compliance_ReturnsOneRowPerItem_DgOnlyForDgDrivers()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req());

        Assert.Equal(7, result.Total);
        Assert.Equal(
            new[]
            {
                "A01:dg_endorsement", "A01:drivers_license", "A01:registration", "A01:wof",
                "B02:drivers_license", "B02:registration", "B02:wof"
            },
            result.Items.Select(Id).Order());
        var licence = result.Items.Single(i => Id(i) == "A01:drivers_license");
        Assert.Equal(1, licence.CourierId);
        Assert.Equal("Driver licence", licence.ComplianceType);
        Assert.Equal("Aroha Ngata", licence.Name);
        Assert.Equal(new DateTime(2024, 1, 14, 18, 30, 0), licence.ExpiryDate!.Value.DateTime);
        Assert.Equal("DG endorsement", result.Items.Single(i => Id(i) == "A01:dg_endorsement").ComplianceType);
        Assert.Equal("WOF", result.Items.Single(i => Id(i) == "A01:wof").ComplianceType);
        Assert.Equal("Registration", result.Items.Single(i => Id(i) == "A01:registration").ComplianceType);
    }

    [Fact]
    public async Task Compliance_StatusAndDaysAreDayGranularInTenantTime()
    {
        await SeedComplianceAsync();

        var items = (await CreateRepository().GetAllCourierComplianceAsync(Req())).Items.ToDictionary(Id);

        // Expired late yesterday evening is -1 day even though the clock is 10:00 today.
        Assert.Equal(("Expired", -1), (items["A01:drivers_license"].Status, items["A01:drivers_license"].DaysUntilExpiry));
        Assert.Equal(("Expiring soon", 42), (items["A01:dg_endorsement"].Status, items["A01:dg_endorsement"].DaysUntilExpiry));
        Assert.Equal(("Not set", (int?)null), (items["A01:wof"].Status, items["A01:wof"].DaysUntilExpiry));
        Assert.Equal("Valid", items["A01:registration"].Status);
        // Expiring today is still "expiring", not expired.
        Assert.Equal(("Expiring soon", 0), (items["B02:drivers_license"].Status, items["B02:drivers_license"].DaysUntilExpiry));
        Assert.Equal(("Valid", 43), (items["B02:wof"].Status, items["B02:wof"].DaysUntilExpiry));
        Assert.Equal(("Expired", -14), (items["B02:registration"].Status, items["B02:registration"].DaysUntilExpiry));
    }

    [Fact]
    public async Task Compliance_TotalsDescribeScopeBeforeStatusFilter()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req(status: "expired"));

        Assert.Equal(2, result.Total);
        Assert.All(result.Items, i => Assert.Equal("Expired", i.Status));
        Assert.Equal(2, result.TotalExpired);
        Assert.Equal(2, result.TotalExpiringSoon);
        Assert.Equal(2, result.TotalValid);
        Assert.Equal(1, result.TotalNotSet);
    }

    [Fact]
    public async Task Compliance_TotalsRespectSearchFleetAndTypeFilters()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req(type: "wof", fleet: 2));

        var item = Assert.Single(result.Items);
        Assert.Equal("B02", item.Code);
        Assert.Equal((0, 0, 1, 0),
            (result.TotalExpired, result.TotalExpiringSoon, result.TotalValid, result.TotalNotSet));

        var searched = await CreateRepository().GetAllCourierComplianceAsync(Req(search: "Aroha"));
        Assert.Equal(4, searched.Total);
    }

    [Fact]
    public async Task Compliance_AttentionStatusIsExpiredExpiringAndNotSet()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req(status: "attention"));

        Assert.Equal(5, result.Total);
        Assert.DoesNotContain(result.Items, i => i.Status == "Valid");

        var notSet = await CreateRepository().GetAllCourierComplianceAsync(Req(status: "not_set"));
        Assert.Equal("wof", Assert.Single(notSet.Items).ComplianceTypeKey);
    }

    [Fact]
    public async Task Compliance_DefaultSortIsExpiryAscendingNotSetFirstThenCode()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req());

        Assert.Equal(
            ["A01:wof", "B02:registration", "A01:drivers_license", "B02:drivers_license", "A01:dg_endorsement",
                "B02:wof", "A01:registration"],
            result.Items.Select(Id));
    }

    [Theory]
    [InlineData("expiryDate")]
    [InlineData("status")]
    [InlineData("daysUntilExpiry")]
    public async Task Compliance_ExpiryAliasesSortIdentically(string key)
    {
        await SeedComplianceAsync();
        var repo = CreateRepository();

        var baseline = await repo.GetAllCourierComplianceAsync(Req(orderBy: "expiryDate", desc: true));
        var result = await repo.GetAllCourierComplianceAsync(Req(orderBy: key, desc: true));

        Assert.Equal(baseline.Items.Select(Id), result.Items.Select(Id));
        Assert.Equal("A01:registration", Id(result.Items.First()));
    }

    [Fact]
    public async Task Compliance_SortByCodeNameAndTypeAndSpansPages()
    {
        await SeedComplianceAsync();
        var repo = CreateRepository();

        var byCode = await repo.GetAllCourierComplianceAsync(Req(orderBy: "code", desc: true, pageSize: 3));
        Assert.Equal(["B02", "B02", "B02"], byCode.Items.Select(i => i.Code));
        var byCodePage3 =
            await repo.GetAllCourierComplianceAsync(Req(orderBy: "code", desc: true, pageSize: 3, page: 3));
        Assert.Equal(["A01"], byCodePage3.Items.Select(i => i.Code));
        Assert.Equal(3, byCode.Pages);

        var byName = await repo.GetAllCourierComplianceAsync(Req(orderBy: "name"));
        Assert.Equal("Aroha Ngata", byName.Items.First().Name);

        var byType = await repo.GetAllCourierComplianceAsync(Req(orderBy: "complianceType"));
        Assert.Equal("dg_endorsement", byType.Items.First().ComplianceTypeKey);
    }

    [Theory]
    [InlineData("bogus", null, null)]
    [InlineData(null, "bogus", null)]
    [InlineData(null, null, "bogus")]
    [InlineData(null, null, "expiry")]
    public async Task Compliance_UnknownSortTypeOrStatus_Throws(string? type, string? status, string? orderBy)
    {
        await SeedComplianceAsync();

        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateRepository().GetAllCourierComplianceAsync(Req(type, status, orderBy)));
        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateRepository().GetCourierComplianceForExportAsync(Req(type, status, orderBy)));
    }

    [Fact]
    public async Task Compliance_AllTypeAndStatusMeanNoFilter()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetAllCourierComplianceAsync(Req(type: "all", status: "ALL"));

        Assert.Equal(7, result.Total);
    }

    [Fact]
    public async Task ComplianceExport_ReturnsSameRowsAsList()
    {
        await SeedComplianceAsync();
        var repo = CreateRepository();

        var list = await repo.GetAllCourierComplianceAsync(Req(status: "attention"));
        var export = await repo.GetCourierComplianceForExportAsync(Req(status: "attention"));

        Assert.Equal(list.Items.Select(i => (Id(i), i.Status, i.DaysUntilExpiry)),
            export.Select(i => (Id(i), i.Status, i.DaysUntilExpiry)));
    }

    [Fact]
    public async Task ComplianceAttention_ByIds_ReturnsOnlyAttentionItemsPerDriver()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetComplianceAttentionAsync([1, 2, 3], null!);

        var aroha = Assert.Single(result, d => d.CourierId == 1);
        Assert.Equal("Aroha", aroha.FirstName);
        Assert.Equal(["Driver licence", "DG endorsement", "WOF"], aroha.Items.Select(i => i.TypeLabel).Order()
            .OrderBy(x => x == "Driver licence" ? 0 : x == "DG endorsement" ? 1 : 2));
        var ben = Assert.Single(result, d => d.CourierId == 2);
        Assert.Equal(["Driver licence", "Registration"], ben.Items.Select(i => i.TypeLabel).Order());
        Assert.DoesNotContain(result, d => d.CourierId == 3);
    }

    [Fact]
    public async Task ComplianceAttention_ByFilter_ResolvesDriversAcrossAllPages()
    {
        await SeedComplianceAsync();

        var result = await CreateRepository().GetComplianceAttentionAsync(null!,
            new CourierComplianceFilterRequest { Fleet = 2, Page = 1, PageSize = 1 });

        var ben = Assert.Single(result);
        Assert.Equal(2, ben.CourierId);
    }

    [Fact]
    public async Task Compliance_DriverWithoutVehicle_HasNoWofOrRegistrationRows()
    {
        await SeedAsync(Courier(1, "A01", "Aroha", "Ngata", configure: c => c.VehiclePlateNnumber = "  "),
            Courier(2, "B02", "Ben", "Hill", configure: c => c.VehiclePlateNnumber = null));
        var repo = CreateRepository();

        var result = await repo.GetAllCourierComplianceAsync(Req());

        Assert.Equal(["drivers_license", "drivers_license"], result.Items.Select(i => i.ComplianceTypeKey));
        Assert.Equal(2, result.TotalNotSet);
        var attention = await repo.GetComplianceAttentionAsync([1, 2], null!);
        Assert.All(attention, d => Assert.Equal(["Driver licence"], d.Items.Select(i => i.TypeLabel)));
    }

    [Theory]
    [InlineData("wof", "all", new[] { "WOF" })]
    [InlineData(null, "expired", new[] { "Driver licence" })]
    [InlineData(null, "expiring", new[] { "DG endorsement" })]
    [InlineData(null, "attention", new[] { "Driver licence", "DG endorsement", "WOF" })]
    [InlineData(null, "valid", new[] { "Driver licence", "DG endorsement", "WOF" })]
    public async Task ComplianceAttention_FilterPath_ScopesItemsToWhatTheUserSaw(string? type, string? status,
        string[] expectedLabels)
    {
        await SeedComplianceAsync();

        var filter = new CourierComplianceFilterRequest { Type = type!, Status = status!, Fleet = 1 };
        var result = await CreateRepository().GetComplianceAttentionAsync(null!, filter);

        var aroha = Assert.Single(result);
        Assert.Equal("Aroha Ngata", aroha.Name);
        Assert.Equal(expectedLabels.Order(), aroha.Items.Select(i => i.TypeLabel).Order());
    }

    // ---------------------------------------------------------------- after hours

    private Task SeedAfterHoursAsync()
    {
        TblAfterhoursCourier Row(int id, int courier, int day, int sh, int sm, int eh, int em) => new()
        {
            Id = id, CourierId = courier, WeekDay = day,
            StartTime = new DateTime(2000, 1, 1, sh, sm, 0), EndTime = new DateTime(2000, 1, 1, eh, em, 0)
        };

        return SeedAsync(
            Courier(1, "B1", "Zed", "Alpha"), Courier(2, "A2", "Amy", "Beta"), Courier(3, "C3", "Mia", "Gamma"),
            Row(1, 1, 1, 8, 0, 16, 0), Row(2, 1, 2, 8, 0, 16, 0),
            Row(3, 2, 3, 22, 0, 4, 0),
            Row(4, 3, 5, 5, 0, 7, 0));
    }

    [Theory]
    [InlineData(null, false, new[] { "Amy Beta", "Mia Gamma", "Zed Alpha" })]
    [InlineData("courierName", true, new[] { "Zed Alpha", "Mia Gamma", "Amy Beta" })]
    [InlineData("courierCode", false, new[] { "Amy Beta", "Zed Alpha", "Mia Gamma" })]
    [InlineData("days", false, new[] { "Zed Alpha", "Amy Beta", "Mia Gamma" })]
    [InlineData("startTime", false, new[] { "Mia Gamma", "Zed Alpha", "Amy Beta" })]
    [InlineData("endTime", false, new[] { "Amy Beta", "Mia Gamma", "Zed Alpha" })]
    [InlineData("duration", false, new[] { "Mia Gamma", "Amy Beta", "Zed Alpha" })]
    [InlineData("duration", true, new[] { "Zed Alpha", "Amy Beta", "Mia Gamma" })]
    public async Task AfterHours_SortKeys(string? orderBy, bool desc, string[] expected)
    {
        await SeedAfterHoursAsync();

        var result = await CreateRepository().GetAfterHoursCourierScheduleAsync(
            new CourierAfterHoursFilterRequest { Page = 1, PageSize = 10, OrderBy = orderBy!, SortDescending = desc });

        Assert.Equal(expected, result.Items.Select(i => i.CourierName));
    }

    [Theory]
    [InlineData("name")]
    [InlineData("code")]
    [InlineData("day")]
    [InlineData("nonsense")]
    public async Task AfterHours_UnknownSortKey_Throws(string key)
    {
        await SeedAfterHoursAsync();
        var request = new CourierAfterHoursFilterRequest { Page = 1, PageSize = 10, OrderBy = key };

        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateRepository().GetAfterHoursCourierScheduleAsync(request));
        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateRepository().GetAfterHoursScheduleForExportAsync(request));
    }

    // ---------------------------------------------------------------- today active

    private Task SeedTodayActiveAsync()
    {
        var today = new DateTime(2024, 1, 15);

        TblCourierLogInOut Login(int id, int courier, DateTime login, DateTime? logout) => new()
        {
            CourierLogInOutId = id, CourierId = courier, LogInTime = login, LogOutTime = logout,
            Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
        };

        TucJob Job(int id, int courier) => new()
        {
            UcjbId = id, UcjbNumber = $"J{id:D3}", UcjbCourierId = courier, UcjbDate = today, CourierPayment = 10m
        };

        return SeedAsync(
            Fleet(1, "Alpha"), Fleet(2, "Beta"), Fleet(3, "Gamma"),
            Login(1, 1, today.AddHours(6), null),
            Login(2, 2, today.AddHours(8), today.AddHours(9)),
            Login(3, 3, today.AddHours(7), today.AddHours(9.5)),
            Login(4, 4, today.AddDays(-1).AddHours(6), null),
            Courier(1, "C", "Zoe", "One", 1, configure: c => c.CourierLogInOutId = 1),
            Courier(2, "A", "Adam", "Two", 2, configure: c => c.CourierLogInOutId = 2),
            Courier(3, "B", "Mo", "Three", 3, configure: c => c.CourierLogInOutId = 3),
            Courier(4, "D", "Old", "Login", 1, configure: c => c.CourierLogInOutId = 4),
            Job(1, 1), Job(2, 1),
            Job(3, 2), Job(4, 2), Job(5, 2), Job(6, 2), Job(7, 2),
            Job(8, 3));
    }

    private static TodayActiveDriversFilterRequest Today(string? orderBy = null, bool desc = false,
        string? status = null, int page = 1, int pageSize = 50) => new()
    {
        OrderBy = orderBy!, SortDescending = desc, Status = status!, Page = page, PageSize = pageSize
    };

    [Theory]
    [InlineData(null, false, new[] { "A", "B", "C" })]
    [InlineData("code", true, new[] { "C", "B", "A" })]
    [InlineData("name", false, new[] { "A", "B", "C" })]
    [InlineData("fleet", false, new[] { "C", "A", "B" })]
    [InlineData("loginTime", false, new[] { "C", "B", "A" })]
    [InlineData("logoutTime", false, new[] { "C", "A", "B" })]
    [InlineData("duration", false, new[] { "A", "B", "C" })]
    [InlineData("duration", true, new[] { "C", "B", "A" })]
    [InlineData("deliveries", false, new[] { "B", "C", "A" })]
    [InlineData("deliveries", true, new[] { "A", "C", "B" })]
    [InlineData("status", false, new[] { "C", "A", "B" })]
    public async Task TodayActive_SortKeys(string? orderBy, bool desc, string[] expectedCodes)
    {
        await SeedTodayActiveAsync();

        var result = await CreateRepository().GetTodayActiveDriversAsync(Today(orderBy, desc));

        Assert.Equal(expectedCodes, result.Items.Select(i => i.Code));
    }

    [Fact]
    public async Task TodayActive_DeliverySortSpansPages()
    {
        await SeedTodayActiveAsync();
        var repo = CreateRepository();

        var page1 = await repo.GetTodayActiveDriversAsync(Today("deliveries", true, pageSize: 2));
        var page2 = await repo.GetTodayActiveDriversAsync(Today("deliveries", true, pageSize: 2, page: 2));

        Assert.Equal(["A", "C"], page1.Items.Select(i => i.Code));
        Assert.Equal(["B"], page2.Items.Select(i => i.Code));
        Assert.Equal([5, 2], page1.Items.Select(i => i.Deliveries));
    }

    [Theory]
    [InlineData("all", 3)]
    [InlineData("active", 1)]
    [InlineData("inactive", 2)]
    public async Task TodayActive_StatusFilter(string status, int expectedTotal)
    {
        await SeedTodayActiveAsync();

        var result = await CreateRepository().GetTodayActiveDriversAsync(Today(status: status));

        Assert.Equal(expectedTotal, result.Total);
    }

    [Fact]
    public async Task TodayActive_DriversActiveTodayCountsEveryoneWhoLoggedInNotJustOnline()
    {
        await SeedTodayActiveAsync();

        var result = await CreateRepository().GetTodayActiveDriversAsync(Today(status: "inactive"));

        Assert.Equal(1, result.TotalActiveDrivers);
        Assert.Equal(3, result.TotalDriversActiveToday);
    }

    [Theory]
    [InlineData("bogus", null)]
    [InlineData(null, "bogus")]
    [InlineData(null, "loginTimes")]
    public async Task TodayActive_UnknownStatusOrSort_Throws(string? status, string? orderBy)
    {
        await SeedTodayActiveAsync();
        var request = Today(orderBy, status: status);

        await Assert.ThrowsAsync<InvalidListQueryException>(() => CreateRepository().GetTodayActiveDriversAsync(request));
        await Assert.ThrowsAsync<InvalidListQueryException>(() =>
            CreateRepository().GetTodayActiveDriversForExportAsync(request));
    }

    // ---------------------------------------------------------------- driver details

    [Fact]
    public async Task Details_MapsEmergencyContactSecurityCheckAndExtraExpiries()
    {
        await SeedAsync(
            Courier(1, "A01", "Aroha", "Ngata", configure: c =>
            {
                c.UccrKinName = "Hemi";
                c.UccrKinTel = "021 555";
                c.UccrKinRelationship = "Brother";
                c.UccrSecurityDate = new DateTime(2023, 6, 1);
                c.Wofexpiry = new DateTime(2024, 3, 1);
                c.RegistrationExpiry = new DateTime(2024, 4, 1);
            }),
            Courier(2, "B02", "Ben", "Hill"));
        var repo = CreateRepository();

        var aroha = await repo.GetCourierDetailsForDashboardAsync(1);
        var ben = await repo.GetCourierDetailsForDashboardAsync(2);

        Assert.True(aroha.BankingAndEmergency.EmergencyContact);
        Assert.Equal(("Hemi", "021 555", "Brother"),
            (aroha.BankingAndEmergency.EmergencyContactName, aroha.BankingAndEmergency.EmergencyContactPhone,
                aroha.BankingAndEmergency.EmergencyContactRelationship));
        Assert.True(aroha.BankingAndEmergency.SecurityCheck);
        Assert.Equal(new DateTime(2023, 6, 1), aroha.BankingAndEmergency.SecurityCheckDate);
        Assert.Equal(new DateTime(2024, 3, 1), aroha.Compliance.WofExpiry);
        Assert.Equal(new DateTime(2024, 4, 1), aroha.Compliance.RegistrationExpiry);
        Assert.False(ben.BankingAndEmergency.EmergencyContact);
        Assert.False(ben.BankingAndEmergency.SecurityCheck);
        Assert.Null(ben.BankingAndEmergency.SecurityCheckDate);
    }
}
