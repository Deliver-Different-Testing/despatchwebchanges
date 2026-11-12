using System.Text.Json;
using System.Text.Json.Nodes;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services.AgentRead;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/dispatch_board (dispatch_board.test.ts).
public class AgentDispatchBoardServiceTests
{
    private static readonly JsonObject Fixture = AgentFixture.Load("dispatch_board");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly ICourierRepository _couriers = Substitute.For<ICourierRepository>();
    private readonly IDfrntViewsRepository _views = Substitute.For<IDfrntViewsRepository>();
    private readonly ITenantInfoService _tenant = Substitute.For<ITenantInfoService>();
    private readonly ILogger<AgentDispatchBoardService> _logger = Substitute.For<ILogger<AgentDispatchBoardService>>();
    private readonly AgentDispatchBoardService _service;
    private const string Secret = "Server=prod-db;Password=hunter2";

    public AgentDispatchBoardServiceTests()
    {
        _service = new AgentDispatchBoardService(_jobs, _couriers, _views, _tenant, _logger);
        var index = Fixture["jobIndex"]!;
        _jobs.JobListAsync(default!, default, default, default, default!, default, default).ReturnsForAnyArgs(new JobSearchResult
        {
            Jobs = index["jobs"].Deserialize<List<DispatchJobViewModel>>(Json)!,
            TotalCount = (int)index["totalCount"]!,
            HasMore = (bool)index["hasMore"]!
        });
        _jobs.GetOverviewStatsAsync().Returns(Fixture["stats"].Deserialize<OverviewStatsViewModel>(Json)!);
        _jobs.GetJobsForOverviewPageAsync(default, default!, default).ReturnsForAnyArgs(Fixture["overviewPage"].Deserialize<PaginatedResponse<DeliveryJob>>(Json)!);
        _couriers.GetClearListsAsync(default!, default, default, default).ReturnsForAnyArgs(Fixture["clearLists"].Deserialize<ClearListViewModel>(Json)!);
        _couriers.GetDriverWorkOverviewAsync().Returns(Fixture["driverWork"].Deserialize<List<DriverWorkOverviewViewModel>>(Json)!);
        _views.GetViewsByUserAndPageAsync(default, default).ReturnsForAnyArgs(Fixture["pageViews"].Deserialize<List<DfrntPageViewModel>>(Json)!);
    }

    private static string[] Warnings(JsonObject o) => [.. o["warnings"]!.AsArray().Select(w => (string)w!)];

    [Fact]
    public async Task BucketsTheBoard_AndReadsEveryViewExplicitly_NeverEmptyNeverInternal()
    {
        var o = await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12, 13]));

        Assert.Equal([12, 13], o["views"]!["ids"]!.AsArray().Select(i => (int)i!).ToArray());
        Assert.Equal("given", (string?)o["views"]!["source"]);
        await _jobs.Received(1).JobListAsync(
            Arg.Any<JobQueryParams>(), Arg.Is<bool>(b => !b), Arg.Any<bool>(), Arg.Any<string>(),
            Arg.Is<IReadOnlyList<int>>(v => v.SequenceEqual(new[] { 12, 13 })), Arg.Any<int?>(), Arg.Any<CancellationToken>());
        await _couriers.Received(1).GetClearListsAsync(Arg.Is<IReadOnlyList<int>>(v => v.SequenceEqual(new[] { 12, 13 })), Arg.Any<DateTimeOffset?>(), Arg.Any<DateTimeOffset?>(), Arg.Is<bool>(b => !b));

        var board = o["board"]!;
        Assert.Equal(8, (int)board["counted"]!);
        Assert.Equal(2, (int)board["needsDriver"]!);
        Assert.Equal(3, (int)board["allocated"]!);
        Assert.Equal(1, (int)board["delivered"]!);
        Assert.Equal(1, (int)board["undeliverable"]!);
        Assert.Equal(1, (int)board["void"]!);
        Assert.Equal(["TC1001DD", "TC1007DD"], o["needsDriver"]!.AsArray().Select(r => (string)r!["jobNo"]!).ToArray());
        Assert.DoesNotContain(o["needsDriver"]!.AsArray(), r => (string?)r!["jobNo"] == "TC1002DD");

        var drivers = o["drivers"]!;
        Assert.Equal(3, (int)drivers["onShift"]!);
        Assert.Equal(1, (int)drivers["idleOnShift"]!);
        Assert.Equal(5, (int)drivers["jobsCarried"]!);
        Assert.Equal(2, (int)o["clearLists"]!["areas"]!);
        Assert.Equal(2, (int)o["clearLists"]!["couriersOnLists"]!);
        Assert.Equal(6, (int)o["clearLists"]!["totalRemaining"]!);
        Assert.Equal(6, (int)o["overview"]!["total"]!);
        Assert.Matches("(?i)not view-filtered", (string)o["overview"]!["scope"]!);
    }

    [Fact]
    public async Task Late_IsStatusOrAnOverdueClock_AndNullRemainIsUnknownNotOnTime()
    {
        var o = await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12]));

        var late = o["late"]!.AsArray().Select(r => (string)r!["jobNo"]!).Order().ToArray();
        Assert.Equal(["TC1003DD", "TC1004DD"], late);
        Assert.Contains(o["late"]!.AsArray(), r => ((string?)r!["lateBecause"] ?? "").Contains("37 minutes past"));
        Assert.Contains(o["late"]!.AsArray(), r => ((string?)r!["lateBecause"] ?? "").Contains("status is LateDelivery"));
        Assert.Equal(2, (int)o["board"]!["remainUnknown"]!);
        Assert.Contains(Warnings(o), w => w.Contains("UNKNOWN for them, not true"));
        Assert.Contains(Warnings(o), w => w.Contains("only count parents of multi-leg families"));
        Assert.Contains("ONLY jobs that have child jobs", (string)o["stats"]!["scope"]!);
    }

    [Fact]
    public async Task NoViewIds_ResolvesThemFromTheUsersViews_AndNoneAvailableAsksInsteadOfGuessing()
    {
        var o = await _service.GetAsync(new DispatchBoardRequest());

        Assert.Equal([12, 13], o["views"]!["ids"]!.AsArray().Select(i => (int)i!).ToArray());
        Assert.Equal("resolved", (string?)o["views"]!["source"]);
        Assert.Equal(["Metro North", "Metro South"], o["views"]!["names"]!.AsArray().Select(v => (string)v!["name"]!).ToArray());
        Assert.Contains(Warnings(o), w => w.Contains("No despatch_view_ids were given"));

        _views.GetViewsByUserAndPageAsync(default, default).ReturnsForAnyArgs(new List<DfrntPageViewModel>());
        _jobs.ClearReceivedCalls();
        var asked = await _service.GetAsync(new DispatchBoardRequest());

        Assert.Equal("despatch_view_ids", (string?)asked["needs"]);
        Assert.Contains("not derivable here", (string)asked["because"]!);
        await _jobs.DidNotReceiveWithAnyArgs().JobListAsync(default!, default, default, default, default!, default, default);
    }

    [Fact]
    public async Task AFailingRead_IsLoggedServerSide_AndItsMessageNeverReachesTheModel()
    {
        _jobs.GetOverviewStatsAsync().Returns<OverviewStatsViewModel>(_ => throw new InvalidOperationException(Secret));
        _couriers.GetDriverWorkOverviewAsync().ThrowsAsync(new InvalidOperationException(Secret));
        _couriers.GetClearListsAsync(default!, default, default, default).ThrowsAsyncForAnyArgs(new InvalidOperationException(Secret));
        _jobs.GetJobsForOverviewPageAsync(default, default!, default).ThrowsAsyncForAnyArgs(new InvalidOperationException(Secret));

        var o = await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12]));

        Assert.DoesNotContain("hunter2", o.ToJsonString());
        Assert.Equal(4, _logger.ReceivedCalls().Count(c => c.GetMethodInfo().Name == "Log"));
    }

    [Fact]
    public async Task ViewIdsTheUserCannotUse_AreRefused_NamingOnlyTheOffendingIds()
    {
        var e = await Assert.ThrowsAsync<AgentReadException>(() => _service.GetAsync(new DispatchBoardRequest(ViewIds: [12, 99, 100])));

        Assert.Contains("99, 100", e.Message);
        Assert.DoesNotContain("12", e.Message.Replace("99, 100", ""));
        await _jobs.DidNotReceiveWithAnyArgs().JobListAsync(default!, default, default, default, default!, default, default);
        await _couriers.DidNotReceiveWithAnyArgs().GetClearListsAsync(default!, default, default, default);
    }

    [Fact]
    public async Task AFailedStatsRead_DegradesToAWarning_TheBoardIsStillAnswered()
    {
        _jobs.GetOverviewStatsAsync().Returns<OverviewStatsViewModel>(_ => throw new InvalidOperationException("boom"));

        var o = await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12]));

        Assert.Null(o["stats"]);
        Assert.Contains(Warnings(o), w => w.Contains("overview stats failed"));
        Assert.Equal(8, (int)o["board"]!["counted"]!);
        Assert.Equal(2, (int)o["board"]!["needsDriver"]!);
    }

    [Fact]
    public async Task APagedBoardWithMoreRows_SaysTheCountsAreThisPageOnly()
    {
        _jobs.JobListAsync(default!, default, default, default, default!, default, default).ReturnsForAnyArgs(new JobSearchResult
        {
            Jobs = Fixture["jobIndex"]!["jobs"].Deserialize<List<DispatchJobViewModel>>(Json)!, TotalCount = 900, HasMore = true
        });

        var o = await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12], PageSize: 99999));

        Assert.Equal(AgentDispatchBoardService.MaxPageSize, (int)o["board"]!["pageSize"]!);
        Assert.Contains(Warnings(o), w => w.Contains("this page only"));
    }

    [Fact]
    public void ThePlaceholderNA_IsNotADriver_AndAnIdOrNameOrCodeIs()
    {
        Assert.Null(DispatchBoardComposer.DriverOf(new DispatchJobViewModel { CourierData = new CourierData { CourierName = "N/A", CourierNumber = "N/A" } }));
        var driver = DispatchBoardComposer.DriverOf(new DispatchJobViewModel { Courier = "CF73", CourierData = new CourierData { CourierId = 73, CourierName = "Cy Fixture" } });
        Assert.Equal(new BoardDriver(73, "Cy Fixture", "CF73"), driver);
    }

    [Fact]
    public void TheResolvedTrio_VoidOwnsItsFlag_ACompletionFlagBeatsNewButNeverAnOutcome()
    {
        Assert.Equal("void", DispatchBoardComposer.Classify([new DispatchJobViewModel { Id = 1, StatusId = 5, Void = true }]).Rows[0].Bucket);
        Assert.Equal("delivered", DispatchBoardComposer.Classify([new DispatchJobViewModel { Id = 2, StatusId = 0, Done = true }]).Rows[0].Bucket);
        Assert.Equal("undeliverable", DispatchBoardComposer.Classify([new DispatchJobViewModel { Id = 3, StatusId = 10, Done = true }]).Rows[0].Bucket);
        Assert.Equal("needs-driver", DispatchBoardComposer.Classify([new DispatchJobViewModel { Id = 4 }]).Rows[0].Bucket);
    }

    [Fact]
    public void ClearListAreas_AreFlattenedOutOfColumns_AndDeduplicated()
    {
        var lists = Fixture["clearLists"].Deserialize<ClearListViewModel>(Json)!;

        var flat = DispatchBoardComposer.SummariseClearLists(lists, null);

        Assert.Equal(2, (int)flat["areas"]!);
        Assert.Equal(2, (int)flat["sections"]!);
        Assert.Equal(["North Run", "South Run"], flat["byArea"]!.AsArray().Select(a => (string)a!["name"]!).ToArray());
    }

    [Fact]
    public async Task TheService_NeverReadsTheAppsNeedsDispatchFilter()
    {
        await _service.GetAsync(new DispatchBoardRequest(ViewIds: [12]));

        await _jobs.Received().JobListAsync(
            Arg.Is<JobQueryParams>(p => p.StatusFilter == null), Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<string>(),
            Arg.Any<IReadOnlyList<int>>(), Arg.Any<int?>(), Arg.Any<CancellationToken>());
        Assert.Equal(AppPage.Dispatch, AppPage.Dispatch);
    }
}




