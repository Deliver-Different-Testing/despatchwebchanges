using System.Text.Json;
using System.Text.Json.Nodes;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services.AgentRead;
using DespatchWeb.Tests.Helpers;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/recurring_check (recurring_check.test.ts).
public class AgentRecurringCheckServiceTests
{
    private static readonly JsonObject Fixture = AgentFixture.Load("recurring_check");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly DateOnly AsOf = DateOnly.Parse((string)Fixture["asOf"]!);

    private readonly IRecurringJobRepository _recurring = Substitute.For<IRecurringJobRepository>();
    private readonly IDeliveryJourneyService _journey = Substitute.For<IDeliveryJourneyService>();
    private readonly ILogger<AgentRecurringCheckService> _logger = Substitute.For<ILogger<AgentRecurringCheckService>>();
    private readonly AgentRecurringCheckService _service;

    public AgentRecurringCheckServiceTests()
    {
        _service = new AgentRecurringCheckService(_recurring, _journey, new FakeTenantClock(new DateTime(2026, 8, 27, 9, 0, 0)), _logger);
        StubList();
        _journey.GetDeliveryJourneyForRecurringBookingAsync(default, default).ReturnsForAnyArgs(ci =>
            _readsFail ? throw new InvalidOperationException(Secret) : Fixture["journeys"]![ci.ArgAt<int>(0).ToString()].Deserialize<RecurringJourneyDto>(Json)!);
        _recurring.GetRecurringJobByIdAsync(default).ReturnsForAnyArgs(ci => _readsFail ? throw new InvalidOperationException(Secret) : new JobGroupViewModel
        {
            Job = Fixture["details"]![ci.ArgAt<int>(0).ToString()]!["job"].Deserialize<JobRecurringViewModel>(Json)!
        });
    }

    private const string Secret = "Server=prod-db;Password=hunter2";
    private bool _readsFail;
    private int? _totalOverride;

    private void StubList() =>
        _recurring.GetRecurringJobsListAsync(default!).ReturnsForAnyArgs(ci =>
        {
            var mode = (int)ci.Arg<RecurringJobQueryRequest>().RecurringMode!;
            var list = Fixture["lists"]![mode.ToString()]!;
            return new PaginatedResponse<PrebookListViewModel>
            {
                Items = list["items"].Deserialize<List<PrebookListViewModel>>(Json)!,
                Total = _totalOverride ?? (int)list["total"]!
            };
        });

    private static JsonObject Booking(JsonObject o, int id) => o["bookings"]!.AsArray().Select(b => b!.AsObject()).Single(b => (int)b["id"]! == id);

    [Fact]
    public async Task DefaultDetail_CountsEveryBooking_AndReturnsRowsForTheProblemsOnly()
    {
        var o = await _service.CheckAsync(new RecurringCheckRequest(AsOf: AsOf));

        Assert.Equal(1, (int)o["counts"]!["firing"]!);
        Assert.Equal(1, (int)o["counts"]!["silent"]!);
        Assert.Equal(0, (int)o["counts"]!["stale"]!);
        Assert.Equal(1, (int)o["counts"]!["never"]!);
        Assert.Equal([1061, 1215], o["bookings"]!.AsArray().Select(b => (int)b!["id"]!).Order().ToArray());

        var countsOnly = await _service.CheckAsync(new RecurringCheckRequest(Detail: "counts", AsOf: AsOf));
        Assert.False(countsOnly.ContainsKey("bookings"));
    }

    [Fact]
    public async Task ClassifiesFiringSilentAndNever_AgainstTheFixtureDate()
    {
        var o = await _service.CheckAsync(new RecurringCheckRequest(Detail: "all", AsOf: AsOf));

        Assert.Equal("firing", (string?)Booking(o, 1198)["status"]);
        Assert.Equal("silent", (string?)Booking(o, 1215)["status"]);
        Assert.Equal(".", (string?)Booking(o, 1215)["bookedBy"]);
        Assert.Equal(7, (int?)Booking(o, 1215)["initialDays"]);
        Assert.Equal("never", (string?)Booking(o, 1061)["status"]);
        Assert.Null(Booking(o, 1061)["lastRun"]);
        Assert.Empty(o["warnings"]!.AsArray());
    }

    [Fact]
    public async Task AFailingRead_IsLoggedServerSide_AndItsMessageNeverReachesTheModel()
    {
        _readsFail = true;

        var o = await _service.CheckAsync(new RecurringCheckRequest(Detail: "all", AsOf: AsOf));

        Assert.DoesNotContain("hunter2", o.ToJsonString());
        Assert.NotEmpty(_logger.ReceivedCalls().Where(c => c.GetMethodInfo().Name == "Log"));
    }

    [Fact]
    public async Task ReceivedNotEqualTotal_IsAWarning_NotASilentShortList()
    {
        _totalOverride = Fixture["lists"]!["1"]!["total"]!.GetValue<int>() + 5;

        var o = await _service.CheckAsync(new RecurringCheckRequest(AsOf: AsOf));

        Assert.Contains(o["warnings"]!.AsArray().Select(w => (string)w!), w => w.Contains("received") && w.Contains("count"));
    }

    [Fact]
    public async Task EachModeIsAskedForSeparately_AsTheListRequires()
    {
        await _service.CheckAsync(new RecurringCheckRequest(IncludeInactive: true, AsOf: AsOf));

        var modes = _recurring.ReceivedCalls().Select(c => c.GetArguments()[0]).OfType<RecurringJobQueryRequest>().Select(r => r.RecurringMode).Distinct().ToList();
        Assert.Equivalent(new RecurringMode?[] { RecurringMode.Active, RecurringMode.Manual, RecurringMode.Inactive }, modes);
    }

    [Fact]
    public void Classify_RunInWindowIsFiring_LastDoneInWindowWithNoRunIsSilent_OlderIsStale_NoRunsIsNever()
    {
        var asOf = new DateOnly(2026, 8, 27);
        static RecurringJourneyRunDto Run(string d) => new() { ServiceDate = DateTimeOffset.Parse($"{d}T16:30:00-07:00") };

        Assert.Equal("firing", AgentRecurringCheckService.Classify(new DateTime(2026, 8, 27), [Run("2026-08-26")], asOf, 7).Status);
        Assert.Equal("silent", AgentRecurringCheckService.Classify(new DateTime(2026, 8, 27), [Run("2026-08-12"), Run("2026-09-03")], asOf, 7).Status);
        Assert.Equal("stale", AgentRecurringCheckService.Classify(new DateTime(2026, 7, 30), [Run("2026-07-12")], asOf, 7).Status);
        Assert.Equal("never", AgentRecurringCheckService.Classify(new DateTime(2026, 7, 30), [], asOf, 7).Status);
    }

    [Fact]
    public void Summarise_CountsEveryStatus()
    {
        var counts = AgentRecurringCheckService.Summarise(["firing", "silent", "silent", "never"]);

        Assert.Equal(2, (int)counts["silent"]!);
        Assert.Equal(0, (int)counts["stale"]!);
    }

    [Fact]
    public async Task TheService_OnlyListsAndReads()
    {
        await _service.CheckAsync(new RecurringCheckRequest(AsOf: AsOf));

        await _recurring.DidNotReceiveWithAnyArgs().UpdateRecurringJobAsync(default, default, default!);
        await _recurring.DidNotReceiveWithAnyArgs().InsertRecurringToLiveAsync(default!);
        await _recurring.DidNotReceiveWithAnyArgs().SaveRecurringJobNote(default!);
    }
}








