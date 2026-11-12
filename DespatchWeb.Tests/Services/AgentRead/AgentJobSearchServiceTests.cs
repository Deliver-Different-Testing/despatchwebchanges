using System.Text.Json.Nodes;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services.AgentRead;
using DespatchWeb.Tests.Helpers;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/shopify_order_jobs (shopify_order_jobs.test.ts).
public class AgentJobSearchServiceTests
{
    private static readonly JsonObject Fixture = AgentFixture.Load("shopify_order_jobs");
    private static string Csv(string key) => (string)Fixture[key]!;
    private static string OrderNumber => (string)Fixture["orderNumber"]!;
    private static string OrderId => (string)Fixture["orderId"]!;

    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly AgentJobSearchService _service;

    public AgentJobSearchServiceTests() =>
        _service = new AgentJobSearchService(_jobs, new FakeTenantClock(new DateTime(2026, 8, 27, 12, 0, 0)));

    private void Stub(Dictionary<string, string> byWild) =>
        _jobs.PodSearchDownloadAsync(default!, default!, default!, default!, default, default, default!, default, default)
            .ReturnsForAnyArgs(ci => Task.FromResult(AgentFixture.Jobs(byWild.GetValueOrDefault(ci.ArgAt<string>(2)) ?? Csv("csvEmpty"))));

    private static string[] Flags(JsonObject o) => [.. o["flags"]!.AsArray().Select(f => (string)f!)];
    private static string[] Warnings(JsonObject o) => [.. o["warnings"]!.AsArray().Select(f => (string)f!)];

    [Fact]
    public async Task TwoFulfilmentOrders_TwoJobs_AndTheWildcardsIncidentalHitIsNotCounted()
    {
        Stub(new() { [OrderNumber] = Csv("csvByNumber"), [OrderId] = Csv("csvById") });

        var o = await _service.SearchAsync(new JobSearchRequest(OrderNumber: "#1042", OrderId: OrderId, ExpectedFulfilmentOrders: 2));

        await _jobs.ReceivedWithAnyArgs(2).PodSearchDownloadAsync(default!, default!, default!, default!, default, default, default!, default, default);
        Assert.Equal("2025-08-27", (string?)o["window"]!["fromDate"]);
        Assert.Equal("2026-09-26", (string?)o["window"]!["toDate"]);
        Assert.True((bool)o["found"]!);
        var counts = o["counts"]!;
        Assert.Equal(2, (int)counts["jobsConfirmed"]!);
        Assert.Equal(2, (int)counts["jobsLive"]!);
        Assert.Equal(1, (int)counts["jobsUnconfirmed"]!);
        Assert.Equal(2, (int)counts["fulfilmentOrdersWithJobs"]!);
        Assert.Equal("PO-91042", (string?)o["unconfirmed"]![0]!["ourReference"]);
        Assert.Equal(["order_id", "order_number"], o["jobs"]![0]!["foundBy"]!.AsArray().Select(f => (string)f!).Order().ToArray());
        Assert.Contains("OurReference = order_number", o["jobs"]![0]!["matchedOn"]!.AsArray().Select(f => (string)f!));
        Assert.DoesNotContain("PARTIAL BOOKING", string.Join(" ", Flags(o)));
        Assert.DoesNotContain("DOUBLE BOOKED", string.Join(" ", Flags(o)));
        Assert.Contains(Flags(o), f => f.Contains("matched the wildcard but carry the order in no reference column"));
    }

    [Fact]
    public async Task AParcelWithNoJob_IsTheSilentPartialBooking()
    {
        Stub(new() { [OrderNumber] = Csv("csvByNumber") });

        var o = await _service.SearchAsync(new JobSearchRequest(OrderNumber: OrderNumber, ExpectedFulfilmentOrders: 3));

        Assert.Equal(2, (int)o["counts"]!["fulfilmentOrdersWithJobs"]!);
        Assert.Equal(3, (int)o["counts"]!["expectedFulfilmentOrders"]!);
        Assert.Contains(Flags(o), f => f.StartsWith("PARTIAL BOOKING"));
        Assert.Contains("A parcel is missing its job", (string)o["verdict"]!);
    }

    [Fact]
    public async Task TwoLiveJobsOnOneFulfilmentOrder_IsADoubleBook()
    {
        Stub(new() { [OrderNumber] = Csv("csvDoubleBooked") });

        var o = await _service.SearchAsync(new JobSearchRequest(OrderNumber: OrderNumber, ExpectedFulfilmentOrders: 1));

        Assert.Equal(2, (int)o["counts"]!["jobsConfirmed"]!);
        Assert.Equal(1, (int)o["counts"]!["fulfilmentOrdersWithJobs"]!);
        Assert.Equal(2, (int)o["parcels"]![0]!["live"]!);
        Assert.Contains("Job Numbers:", Flags(o).Single(f => f.StartsWith("DOUBLE BOOKED")));
        Assert.DoesNotContain("PARTIAL BOOKING", string.Join(" ", Flags(o)));
    }

    [Fact]
    public async Task FixedReferences_ParcelsAreRefused_NotGuessed()
    {
        Stub(new() { [OrderId] = Csv("csvOverriddenReferences") });

        var o = await _service.SearchAsync(new JobSearchRequest(OrderNumber: OrderNumber, OrderId: OrderId));

        Assert.Equal(2, (int)o["counts"]!["jobsConfirmed"]!);
        Assert.Null(o["counts"]!["fulfilmentOrdersWithJobs"]);
        Assert.Empty(o["parcels"]!.AsArray());
        Assert.Contains("fixed ClientReferenceB in Settings", (string)o["parcelsNotCountedBecause"]!);
        Assert.DoesNotContain("DOUBLE BOOKED", string.Join(" ", Flags(o)));
        Assert.Contains(Warnings(o), w => w.Contains("No job carries the order number in OurReference"));
        Assert.Contains(Flags(o), f => f.Contains("priced $0"));
    }

    [Fact]
    public async Task NoRows_IsNotFound_WithTheReasonsThatAreNotABookingFailure()
    {
        Stub([]);

        var o = await _service.SearchAsync(new JobSearchRequest(OrderNumber: "9999"));

        Assert.False((bool)o["found"]!);
        Assert.Equal(0, (int)o["counts"]!["jobsConfirmed"]!);
        Assert.Contains("NO JOB FOUND", (string)o["verdict"]!);
        Assert.Contains(Warnings(o), w => w.Contains("BookDate") && w.Contains("ShopRef1/2/3"));
        Assert.DoesNotContain("PARTIAL BOOKING", string.Join(" ", Flags(o)));
    }

    [Fact]
    public void ASubstringOnlyHit_IsNeverConfirmed_AndAMerchantsHashIsTheSameOrder()
    {
        SearchTerm[] terms = [new("order_number", "1042")];
        var incidental = JobSearchComposer.Classify(new JobDownloadModel { Id = 1, JobNumber = "SX9TST", OurReference = "PO-91042" }, terms, ["order_number"]);
        var hashed = JobSearchComposer.Classify(new JobDownloadModel { Id = 2, JobNumber = "SX8TST", OurReference = "#1042" }, terms, ["order_number"]);

        Assert.False(incidental.Confirmed);
        Assert.Empty(incidental.MatchedOn);
        Assert.True(hashed.Confirmed);
        Assert.False(JobSearchComposer.ParcelIdsUsable([]).Usable);
        Assert.False(JobSearchComposer.ParcelIdsUsable([hashed with { Row = new JobDownloadModel { Id = 2, ClientReferenceB = "" } }]).Usable);
        Assert.True(JobSearchComposer.ParcelIdsUsable([hashed with { Row = new JobDownloadModel { Id = 2, ClientReferenceB = "7788110000001" } }]).Usable);
    }

    [Theory]
    [InlineData(null, "uninvoiced")]
    [InlineData(0, "zero")]
    [InlineData(417696, "invoiced")]
    public void InvoiceNumber_BlankZeroAndNumberAreThreeStates(int? number, string state) =>
        Assert.Equal(state, JobSearchComposer.InvoiceState(number));

    [Fact]
    public async Task ListMode_PagesAndCapsPageSize_AndKeepsNulls()
    {
        var rows = Enumerable.Range(1, 130).Select(i => new JobDownloadModel
        {
            Id = i, JobNumber = $"J{i:D4}", BookDate = new DateTime(2026, 8, 1), Amount = i == 1 ? null : i
        }).ToList();
        _jobs.PodSearchDownloadAsync(default!, default!, default!, default!, default, default, default!, default, default)
            .ReturnsForAnyArgs(Task.FromResult<IReadOnlyList<JobDownloadModel>>(rows));

        var o = await _service.SearchAsync(new JobSearchRequest(Query: "abcd", Page: 2, PageSize: 1000));

        Assert.Equal(100, (int)o["pageSize"]!);
        Assert.Equal(130, (int)o["counts"]!["jobs"]!);
        Assert.Equal(30, o["jobs"]!.AsArray().Count);
        Assert.False((bool)o["hasMore"]!);
        var first = await _service.SearchAsync(new JobSearchRequest(Query: "abcd"));
        Assert.True((bool)first["hasMore"]!);
        Assert.Null(first["jobs"]![0]!["amount"]);
        Assert.True(first["jobs"]![0]!.AsObject().ContainsKey("amount"));
    }

    [Fact]
    public async Task AWindowOverTheCap_IsRefused() =>
        await Assert.ThrowsAsync<AgentReadException>(() => _service.SearchAsync(
            new JobSearchRequest(From: new DateOnly(2024, 1, 1), To: new DateOnly(2026, 1, 1))));

    [Fact]
    public async Task ReferenceFilter_ListsOnlyExactReferenceMatches_AndCountsTheRest()
    {
        Stub(new() { [OrderNumber] = Csv("csvByNumber") });

        var o = await _service.SearchAsync(new JobSearchRequest(Reference: "#1042"));

        Assert.Equal(2, (int)o["counts"]!["jobs"]!);
        Assert.Equal(1, (int)o["counts"]!["notMatchingReference"]!);
    }
}
