using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using DespatchWeb.Services.AgentRead;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/driver_day (driver_day.test.ts). The prototype read the wire JSON of the
// three POST screens; the typed reads carry a courier id on every compliance row and name minutes as minutes.
public partial class AgentDriverDayServiceTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-08-27T14:20:00+12:00", CultureInfo.InvariantCulture);
    private static readonly JsonObject Fixture = AgentFixture.Load("driver_day");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [GeneratedRegex(@"^(\d+)\s+days(\s+overdue)?$", RegexOptions.IgnoreCase)]
    private static partial Regex Days();

    private readonly ICourierRepository _couriers = Substitute.For<ICourierRepository>();
    private readonly IDfrntViewsRepository _views = Substitute.For<IDfrntViewsRepository>();
    private readonly ITenantInfoService _tenant = Substitute.For<ITenantInfoService>();
    private readonly ILogger<AgentDriverDayService> _logger = Substitute.For<ILogger<AgentDriverDayService>>();
    private readonly AgentDriverDayService _service;
    private const string Secret = "Server=prod-db;Password=hunter2";
    private Func<int, TodayActiveDriversPaginatedResponse> _activePage;
    private bool _complianceFails;

    public AgentDriverDayServiceTests()
    {
        _service = new AgentDriverDayService(_couriers, _views, _tenant, _logger);
        var pages = Fixture["activeDriverPages"]!.AsArray();
        _activePage = p => pages[p - 1].Deserialize<TodayActiveDriversPaginatedResponse>(Json)!;
        var idByCode = pages.SelectMany(pg => pg!["items"]!.AsArray()).ToDictionary(i => (string)i!["code"]!, i => (int)i!["courierId"]!);

        _couriers.GetTodayActiveDriversAsync(default!).ReturnsForAnyArgs(ci => _activePage(ci.Arg<TodayActiveDriversFilterRequest>().Page));
        _couriers.GetAllCourierComplianceAsync(default!).ReturnsForAnyArgs(_ =>
        {
            if (_complianceFails) throw new InvalidOperationException("boom");
            var c = Fixture["compliance"]!;
            return new CourierCompliancePaginatedResponse
            {
                Items = [.. c["items"]!.AsArray().Select(r => new CourierComplianceViewModel
                {
                    CourierId = idByCode.GetValueOrDefault((string)r!["code"]!),
                    Code = (string)r["code"]!,
                    Name = (string?)r["name"]!,
                    ComplianceType = (string?)r["complianceType"]!,
                    ExpiryDate = r["expiryDate"] is { } e ? DateTimeOffset.Parse((string)e, CultureInfo.InvariantCulture) : null,
                    Status = (string)r["status"]!,
                    DaysUntilExpiry = ParseDays((string?)r["daysUntilExpiry"])
                })],
                Total = (int)c["total"]!, Pages = 1,
                TotalExpired = (int)c["totalExpired"]!, TotalExpiringSoon = (int)c["totalExpiringSoon"]!, TotalValid = (int)c["totalValid"]!
            };
        });
        _couriers.GetCourierDailyEarningsAsync(default!).ReturnsForAnyArgs(_ =>
        {
            var e = Fixture["earnings"]!;
            return new CourierDailyEarningsPaginatedResponse
            {
                Items = [.. e["items"]!.AsArray().Select(r => new CourierDailyEarningsViewModel
                {
                    CourierId = (int)r!["courierId"]!, Name = (string)r["name"]!, MinutesLogged = (int)r["hoursLogged"]!,
                    Deliveries = (int)r["deliveries"]!, Earnings = (decimal)r["earnings"]!, HourlyRate = (decimal)r["hourlyRate"]!
                })],
                Total = (int)e["total"]!, Pages = 1,
                TotalEarningsToday = (decimal)e["totalEarningsToday"]!, AverageHourlyRate = (decimal)e["averageHourlyRate"]!,
                TotalDeliveriesToday = (int)e["totalDeliveriesToday"]!
            };
        });
        _couriers.GetClearListsAsync(default!, default, default, default).ReturnsForAnyArgs(Fixture["board"].Deserialize<ClearListViewModel>(Json)!);
        _views.GetViewsByUserAndPageAsync(default, default).ReturnsForAnyArgs(new List<DfrntPageViewModel> { new() { Id = 49, Name = "Default" }, new() { Id = 12, Name = "Twelve" }, new() { Id = 17, Name = "Seventeen" } });
    }

    private static int? ParseDays(string? raw)
    {
        var m = raw is null ? null : Days().Match(raw.Trim());
        return m is { Success: true } ? int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) * (m.Groups[2].Success ? -1 : 1) : null;
    }

    private static JsonObject Driver(JsonObject o, string code) => o["drivers"]!.AsArray().Select(d => d!.AsObject()).Single(d => (string?)d["code"] == code);
    private static string[] Flags(JsonObject d) => [.. d["flags"]!.AsArray().Select(f => (string)f!)];
    private static string[] Warnings(JsonObject o) => [.. o["warnings"]!.AsArray().Select(w => (string)w!)];

    [Fact]
    public async Task PagesBothDriverPages_JoinsComplianceAndMoney_AndDedupesTheBoard()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));

        await _couriers.Received().GetTodayActiveDriversAsync(Arg.Is<TodayActiveDriversFilterRequest>(r => r.Page == 1 && r.PageSize == 100));
        await _couriers.Received().GetTodayActiveDriversAsync(Arg.Is<TodayActiveDriversFilterRequest>(r => r.Page == 2));
        Assert.Equal(5, o["drivers"]!.AsArray().Count);
        Assert.Equal(5, (int)o["counts"]!["driversWhoLoggedInToday"]!);
        Assert.True((bool)o["counts"]!["listsComplete"]!["todaysDrivers"]!);

        var dr01 = Driver(o, "DR01");
        Assert.Equal(498, (int)dr01["sessionMinutes"]!);
        Assert.Equal(312.5m, (decimal)dr01["courierPaymentToday"]!);
        Assert.Equal(6, (int)dr01["board"]!["jobCount"]!);
        Assert.Equal(["Central", "Harbour"], dr01["board"]!["areas"]!.AsArray().Select(a => (string)a!).ToArray());
        Assert.Equal(["Newtown", "Southgate", "Riverbend"], dr01["board"]!["destinations"]!.AsArray().Select(a => (string)a!).ToArray());
        Assert.Equal(3, (int)o["board"]!["areas"]!);

        Assert.Equal(2, (int)o["counts"]!["complianceHeader"]!["expired"]!);
        Assert.Equal(1, o["drivers"]!.AsArray().Count(d => (string?)d!["compliance"]!["class"] == "expired"));
        Assert.Equal(31, (int)o["counts"]!["tenantWide"]!["deliveriesCompletedToday"]!);
        Assert.Equal(1, (int)o["counts"]!["complianceRowsForDriversNotOnShift"]!);
    }

    [Fact]
    public async Task Flags_ExpiredWhileLoggedIn_Expiring_NotSet_LoggedOutCarrying_Idle_LongSession_ClockInversion()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));

        Assert.Equal("expired", (string?)Driver(o, "DR01")["compliance"]!["class"]);
        Assert.Equal(-3, (int)Driver(o, "DR01")["compliance"]!["daysUntilExpiry"]!);
        Assert.Matches("EXPIRED .*logged in right now", Flags(Driver(o, "DR01")).First(f => f.StartsWith("EXPIRED")));

        Assert.Equal("expiring_soon", (string?)Driver(o, "DR02")["compliance"]!["class"]);
        Assert.Contains(Flags(Driver(o, "DR02")), f => f.Contains("expires in 12 days"));
        Assert.Contains(Flags(Driver(o, "DR02")), f => f.Contains("idle"));

        Assert.Equal("valid", (string?)Driver(o, "DR03")["compliance"]!["class"]);
        Assert.Contains(Flags(Driver(o, "DR03")), f => f.Contains("Logged out with 4 job(s) still on the board"));

        Assert.Equal("not_set", (string?)Driver(o, "DR04")["compliance"]!["class"]);
        Assert.Contains(Flags(Driver(o, "DR04")), f => f.Contains("counts this driver as VALID"));
        Assert.Contains(Flags(Driver(o, "DR04")), f => f.Contains("still open"));

        Assert.Equal("unknown", (string?)Driver(o, "DR05")["compliance"]!["class"]);
        Assert.Contains(Flags(Driver(o, "DR05")), f => f.Contains("Compliance not checked"));
        Assert.Contains(Flags(Driver(o, "DR05")), f => f.Contains("Logout is BEFORE login"));

        var boardOnly = o["boardOnly"]!.AsArray();
        Assert.Single(boardOnly);
        Assert.Equal(606, (int)boardOnly[0]!["courierId"]!);
        Assert.Contains(Flags(boardOnly[0]!.AsObject()), f => f.Contains("On the board but not in today's login list"));
    }

    [Fact]
    public async Task BoardPlaceholders_NeverSurfaceAsData_AndTheViewsUsedAreNamed()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));

        Assert.Equal("49, 12, 17", (string?)o["board"]!["viewIds"]);
        Assert.Contains(Warnings(o), w => w.Contains("No despatch_view_ids were given"));
        Assert.DoesNotContain("Unknown", new JsonObject { ["d"] = o["drivers"]!.DeepClone(), ["b"] = o["boardOnly"]!.DeepClone() }.ToJsonString());

        await _service.GetAsync(new DriverDayRequest(Detail: "counts", Now: Now, ViewIds: [12, 17]));
        await _couriers.Received().GetClearListsAsync(Arg.Is<IReadOnlyList<int>>(v => v.SequenceEqual(new[] { 12, 17 })), Arg.Any<DateTimeOffset?>(), Arg.Any<DateTimeOffset?>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task AFailingList_IsLoggedServerSide_AndItsMessageNeverReachesTheModel()
    {
        _couriers.GetAllCourierComplianceAsync(default!).ThrowsAsyncForAnyArgs(new InvalidOperationException(Secret));
        _couriers.GetCourierDailyEarningsAsync(default!).ThrowsAsyncForAnyArgs(new InvalidOperationException(Secret));
        _couriers.GetClearListsAsync(default!, default, default, default).ThrowsAsyncForAnyArgs(new InvalidOperationException(Secret));

        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));

        Assert.DoesNotContain("hunter2", o.ToJsonString());
        Assert.Equal(3, _logger.ReceivedCalls().Count(c => c.GetMethodInfo().Name == "Log"));
    }

    [Fact]
    public async Task ARejectedListQuery_IsRethrownAsAFixedSentence_NotTheExceptionText()
    {
        _activePage = _ => throw new InvalidListQueryException(Secret);

        var e = await Assert.ThrowsAsync<AgentReadException>(() => _service.GetAsync(new DriverDayRequest(Now: Now)));

        Assert.DoesNotContain("hunter2", e.Message);
        Assert.Contains("rejected", e.Message);
    }

    [Fact]
    public async Task ViewIdsTheUserCannotUse_AreRefused_NamingOnlyTheOffendingIds()
    {
        var e = await Assert.ThrowsAsync<AgentReadException>(() => _service.GetAsync(new DriverDayRequest(Now: Now, ViewIds: [12, 99])));

        Assert.Contains("99", e.Message);
        Assert.DoesNotContain("12", e.Message);
        await _couriers.DidNotReceiveWithAnyArgs().GetClearListsAsync(default!, default, default, default);
    }

    [Fact]
    public async Task ForeignViewIds_AreIgnored_WhenTheBoardIsNotRequested()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Detail: "counts", Now: Now, ViewIds: [99], IncludeBoard: false));

        Assert.NotNull(o);
    }

    [Fact]
    public async Task AShortList_IsIncomplete_AndAComplianceFailureNeverReadsAsValid()
    {
        var page1 = _activePage(1);
        _activePage = p => p == 1 ? page1 : new TodayActiveDriversPaginatedResponse { Items = [], Total = 5, Page = p, Pages = 2 };
        _complianceFails = true;

        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));

        Assert.Equal(3, o["drivers"]!.AsArray().Count);
        Assert.False((bool)o["counts"]!["listsComplete"]!["todaysDrivers"]!);
        Assert.Contains(Warnings(o), w => w.Contains("INCOMPLETE"));
        Assert.Contains(Warnings(o), w => w.Contains("compliance failed"));
        Assert.Null(o["counts"]!["complianceHeader"]);
        Assert.All(o["drivers"]!.AsArray(), d => Assert.Equal("unknown", (string?)d!["compliance"]!["class"]));
        Assert.DoesNotContain("\"class\":\"valid\"", o["drivers"]!.ToJsonString());
    }

    [Fact]
    public async Task NobodyLoggedIn_IsSaidPlainly_WithTheReasonItIsNotProofNobodyIsWorking()
    {
        _activePage = _ => Fixture["emptyActiveDrivers"].Deserialize<TodayActiveDriversPaginatedResponse>(Json)!;

        var o = await _service.GetAsync(new DriverDayRequest(Now: Now));

        Assert.Empty(o["drivers"]!.AsArray());
        Assert.Equal(0, (int)o["counts"]!["driversWhoLoggedInToday"]!);
        Assert.Contains("began yesterday", (string)o["message"]!);
    }

    [Fact]
    public async Task DefaultDetail_ReturnsOnlyFlaggedDrivers_AndAFleetAskWarnsTheMoneyIsUnfiltered()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Now: Now, Fleet: 3));

        Assert.NotEmpty(o["drivers"]!.AsArray());
        Assert.All(o["drivers"]!.AsArray(), d => Assert.NotEmpty(d!["flags"]!.AsArray()));
        Assert.Contains(Warnings(o), w => w.Contains("UNFILTERED"));
        Assert.Contains("detail=\"attention\"", (string)o["message"]!);
    }

    [Fact]
    public async Task MoneyIsOmittedWithoutTheCostsClass_AndNamesAndComplianceStay()
    {
        var o = await _service.GetAsync(new DriverDayRequest(Detail: "all", Now: Now));
        var projected = AgentFieldProjector.Apply(o, new HashSet<string>(), costsPermitted: true);
        var text = ((JsonObject)projected.DeepClone()).Where(_ => true).Aggregate(new JsonObject(), (acc, kv) => { if (kv.Key != "redacted") acc[kv.Key] = kv.Value?.DeepClone(); return acc; }).ToJsonString();

        Assert.DoesNotContain("courierPaymentToday", text);
        Assert.DoesNotContain("hourlyRate", text);
        Assert.DoesNotContain("averageHourlyRate", text);
        Assert.Equal("Alex Sample", (string?)Driver(projected, "DR01")["untrusted_text"]!["name"]);
        Assert.Equal("expired", (string?)Driver(projected, "DR01")["compliance"]!["class"]);
    }

    [Fact]
    public void ComplianceStatusWords_MapToClasses_AndSessionsAreMeasuredFromTheTimes()
    {
        Assert.Equal("expiring_soon", DriverDayComposer.ClassifyCompliance("Expiring Soon"));
        Assert.Equal("not_set", DriverDayComposer.ClassifyCompliance("Not Set"));
        Assert.Equal("unknown", DriverDayComposer.ClassifyCompliance(null));
        Assert.Equal(510, DriverDayComposer.SessionMinutes(DateTimeOffset.Parse("2026-08-27T06:00:00+12:00", CultureInfo.InvariantCulture), DateTimeOffset.Parse("2026-08-27T14:30:00+12:00", CultureInfo.InvariantCulture), Now));
        Assert.Null(DriverDayComposer.SessionMinutes(null, null, Now));
        var indexed = DriverDayComposer.IndexBoard(Fixture["board"].Deserialize<ClearListViewModel>(Json));
        Assert.Equal(4, indexed.ByCourier.Count);
    }
}







