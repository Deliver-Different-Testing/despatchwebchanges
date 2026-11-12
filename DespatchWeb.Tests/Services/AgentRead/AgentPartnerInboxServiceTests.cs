using System.Text.Json;
using System.Text.Json.Nodes;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services.AgentRead;
using DespatchWeb.Tests.Helpers;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/partner_inbox (partner_inbox.test.ts).
public class AgentPartnerInboxServiceTests
{
    private const string AsOf = "2026-08-27T09:00";
    private static readonly JsonObject Fixture = AgentFixture.Load("partner_inbox");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IJobChangeRequestService _requests = Substitute.For<IJobChangeRequestService>();
    private readonly ISendToPartnerService _partner = Substitute.For<ISendToPartnerService>();
    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly AgentPartnerInboxService _service;

    public AgentPartnerInboxServiceTests()
    {
        _service = new AgentPartnerInboxService(_requests, _partner, _jobs, new FakeTenantClock(new DateTime(2026, 8, 27, 9, 0, 0)));
        _jobs.GetJobWithoutMarkingReadAsync(default).ReturnsForAnyArgs(new JobViewModel());
        var queue = Fixture["pending"]!.Deserialize<List<JobChangeRequestInboxItem>>(Json)!;
        _requests.HasActivePartnersAsync(default).ReturnsForAnyArgs(true);
        _requests.ListPendingForApprovalAsync(default, default).ReturnsForAnyArgs(ci => (IReadOnlyList<JobChangeRequestInboxItem>)queue);
        _requests.ListForJobAsync(default, default).ReturnsForAnyArgs(ci =>
            (IReadOnlyList<JobChangeRequestDto>)(Fixture["history"]![ci.ArgAt<int>(0).ToString()]?.Deserialize<List<JobChangeRequestDto>>(Json) ?? []));
        _partner.GetInboundJobAcceptanceStateAsync(default, default).ReturnsForAnyArgs(ci =>
            Task.FromResult(Fixture["acceptance"]![ci.ArgAt<int>(0).ToString()]?.Deserialize<PartnerInboundJobAcceptanceStateResponse>(Json)));
    }

    private static JsonObject Request(JsonObject o, int id) => o["requests"]!.AsArray().Select(r => r!.AsObject()).Single(r => (int)r["requestId"]! == id);
    private static string[] Flags(JsonNode r, string member = "flags") => [.. r[member]!.AsArray().Select(f => (string)f!)];

    [Fact]
    public async Task ReadsTheQueueTheHistoryAndTheRateGate_AndClassifiesEveryRow()
    {
        var o = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf));

        Assert.True((bool)o["ok"]!);
        Assert.Equal("queue", (string?)o["mode"]);
        Assert.True((bool)o["hasActivePartners"]!);
        await _requests.Received(1).ListPendingForApprovalAsync(100, Arg.Any<CancellationToken>());
        await _requests.ReceivedWithAnyArgs(5).ListForJobAsync(default, default);
        await _partner.ReceivedWithAnyArgs(5).GetInboundJobAcceptanceStateAsync(default, default);

        var counts = o["counts"]!;
        Assert.Equal(5, (int)counts["total"]!);
        Assert.Equal(2, (int)counts["rate_gate_blocked"]!);
        Assert.Equal(1, (int)counts["commercial"]!);
        Assert.Equal(1, (int)counts["auto_mode_pending"]!);
        Assert.Equal(1, (int)counts["operational"]!);
        Assert.Equal(1, (int)counts["stale"]!);
        Assert.Equal(4, (int)counts["flagged"]!);
        Assert.Equal(1, (int)o["byField"]!["PartnerAgreedRate"]!);

        var rate = Request(o, 9101);
        Assert.Equal("AA1001TST", (string?)rate["jobNo"]);
        Assert.Equal("commercial", (string?)rate["classification"]);
        Assert.Equal(180m, (decimal)rate["money"]!["old"]!);
        Assert.Equal(245m, (decimal)rate["money"]!["new"]!);
        Assert.Equal(65m, (decimal)rate["money"]!["delta"]!);
        Assert.Equal(3, (double)rate["waitingHours"]!);
        Assert.Contains(Flags(rate), f => f.Contains("Approved but never Applied"));
        Assert.Contains(Flags(rate), f => f.Contains("same field"));
    }

    [Fact]
    public async Task JobMode_ForAJobTheCallerCannotSee_ReadsNoHistoryAndNoGate()
    {
        _jobs.GetJobWithoutMarkingReadAsync(default).ThrowsAsyncForAnyArgs(new KeyNotFoundException());

        var o = await _service.GetAsync(new PartnerInboxRequest(JobId: 9101, AsOf: AsOf));

        Assert.False((bool)o["found"]!);
        Assert.Equal(9101, (int)o["jobId"]!);
        Assert.Null(o["acceptance"]);
        await _requests.DidNotReceiveWithAnyArgs().ListForJobAsync(default, default);
        await _partner.DidNotReceiveWithAnyArgs().GetInboundJobAcceptanceStateAsync(default, default);
    }

    [Fact]
    public async Task JobMode_ForAVisibleJob_LoadsItThroughTheCallersContextFirst()
    {
        var o = await _service.GetAsync(new PartnerInboxRequest(JobId: 9101, AsOf: AsOf));

        await _jobs.Received(1).GetJobWithoutMarkingReadAsync(9101);
        await _partner.ReceivedWithAnyArgs(1).GetInboundJobAcceptanceStateAsync(default, default);
        Assert.NotNull(o["acceptance"]);
    }

    [Theory]
    [InlineData(100000, 50)]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    public async Task MaxJobs_IsClampedTo1Through50_AndTheClampIsWarned(int asked, int effective)
    {
        var template = Fixture["pending"]![0]!.ToJsonString();
        var queue = Enumerable.Range(0, 60).Select(i =>
        {
            var item = JsonNode.Parse(template)!.AsObject();
            item["request"]!["jobId"] = 5000 + i;
            return item.Deserialize<JobChangeRequestInboxItem>(Json)!;
        }).ToList();
        _requests.ListPendingForApprovalAsync(default, default).ReturnsForAnyArgs(ci => (IReadOnlyList<JobChangeRequestInboxItem>)queue);

        var o = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf, MaxJobs: asked));

        Assert.Equal(effective, (int)o["jobsRead"]!);
        await _partner.ReceivedWithAnyArgs(effective).GetInboundJobAcceptanceStateAsync(default, default);
        Assert.Contains(o["warnings"]!.AsArray().Select(w => (string)w!), w => w.Contains("max_jobs") && w.Contains("1..50"));
    }

    [Fact]
    public async Task TheRateGate_AndTheFieldPolicy_EachGetTheirOwnClassification()
    {
        var o = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf, Detail: "all"));

        var pending = Request(o, 9102);
        Assert.Equal("rate_gate_blocked", (string?)pending["classification"]);
        Assert.Contains(Flags(pending), f => f.Contains("cannot be allocated"));
        Assert.Contains(Flags(pending, "priceFlags"), f => f.Contains("132.75"));
        Assert.Equal(51, (double)pending["waitingHours"]!);
        Assert.Contains(Flags(pending), f => f.StartsWith("Waiting 51h"));
        Assert.Null(pending["money"]!["new"]);
        Assert.Null(pending["money"]!["delta"]);

        var rejected = Request(o, 9105);
        Assert.Equal("rate_gate_blocked", (string?)rejected["classification"]);
        Assert.Contains(Flags(rejected), f => f.Contains("REJECTED"));
        Assert.Contains("below the agreed lane floor", (string)rejected["acceptance"]!["rejectionReason"]!);
        Assert.Equal(126.4m, (decimal)rejected["money"]!["delta"]!);

        var manual = Request(o, 9103);
        Assert.Equal("operational", (string?)manual["classification"]);
        Assert.Equal("Accepted", (string?)manual["acceptance"]!["status"]);
        Assert.True((bool)manual["acceptance"]!["known"]!);
        Assert.Null(manual["money"]);

        var auto = Request(o, 9104);
        Assert.Equal("auto_mode_pending", (string?)auto["classification"]);
        Assert.Contains(Flags(auto), f => f.Contains("Auto but the row is still Pending"));
        Assert.Equal("Allowed", (string?)auto["acceptance"]!["status"]);
        Assert.False((bool)auto["acceptance"]!["known"]!);

        var allowed = PartnerInboxComposer.ReadAcceptance(new PartnerInboundJobAcceptanceStateResponse { Status = "Allowed" });
        Assert.False(allowed.Known);
        Assert.False(allowed.BlocksAllocation);
        Assert.Contains("no acceptance state recorded", allowed.Meaning);
        Assert.Contains("Never read it as \"the partner accepted\"", allowed.Meaning);

        var blocked = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf, Only: "blocked"));
        Assert.Equal(2, (int)blocked["matched"]!);
        Assert.Equal(5, (int)blocked["counts"]!["total"]!);
    }

    [Fact]
    public async Task ALimitOutsideTheBand_IsClampedHere_NotSilentlyRewrittenByTheQueue()
    {
        Assert.Equal((250, null), PartnerInboxComposer.ClampLimit(250));
        Assert.Equal(500, PartnerInboxComposer.ClampLimit(1000).Effective);
        Assert.Contains("silently become 200", PartnerInboxComposer.ClampLimit(1000).Warning);

        var o = await _service.GetAsync(new PartnerInboxRequest(Limit: 1000, Detail: "counts", AsOf: AsOf));

        Assert.Equal(500, (int)o["limitAsked"]!);
        await _requests.Received(1).ListPendingForApprovalAsync(500, Arg.Any<CancellationToken>());
        Assert.Contains(o["warnings"]!.AsArray().Select(w => (string)w!), w => w.Contains("outside the 1..500 band"));
    }

    [Fact]
    public async Task AJobWithNoChangeRequests_IsReportedAsNone_AndItsGateIsStillRead()
    {
        var none = await _service.GetAsync(new PartnerInboxRequest(JobId: 700900, AsOf: AsOf));

        Assert.Equal("job", (string?)none["mode"]);
        Assert.False((bool)none["found"]!);
        Assert.Equal(0, (int)none["requestCount"]!);
        Assert.Empty(none["requests"]!.AsArray());
        Assert.Equal("Allowed", (string?)none["acceptance"]!["status"]);
        Assert.False((bool)none["acceptance"]!["known"]!);
        Assert.Contains("No change request has ever been raised", (string)none["message"]!);
        await _requests.DidNotReceiveWithAnyArgs().ListPendingForApprovalAsync(default, default);

        var full = await _service.GetAsync(new PartnerInboxRequest(JobId: 700101, AsOf: AsOf));
        Assert.True((bool)full["found"]!);
        Assert.Equal(3, (int)full["requestCount"]!);
        Assert.Contains(full["requests"]!.AsArray(), r => (string?)r!["origin"] == "Local" && (string?)r["status"] == "Applied");
        Assert.Contains(Flags(full), f => f.Contains("Approved but never Applied"));
    }

    [Fact]
    public async Task AHiddenBadge_DoesNotEmptyTheQueue()
    {
        _requests.HasActivePartnersAsync(default).ReturnsForAnyArgs(false);

        var o = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf, Detail: "all"));

        Assert.False((bool)o["hasActivePartners"]!);
        Assert.Equal(5, (int)o["counts"]!["total"]!);
        Assert.Contains(o["warnings"]!.AsArray().Select(w => (string)w!), w => w.Contains("hasActivePartners is false") && w.Contains("5 request"));
    }

    [Fact]
    public async Task HistoryNotRead_IsDistinctFromNoHistory()
    {
        var item = new JobChangeRequestInboxItem
        {
            Request = new JobChangeRequestDto
            {
                Id = 1, JobId = 2, FieldName = "Notes", Status = "Pending", ApprovalMode = "Manual", Origin = "Peer",
                RequestedAt = new DateTime(2026, 8, 27, 8, 0, 0)
            },
            JobNo = "ZZ9999TST", ClientName = "Invented Co"
        };

        var unread = PartnerInboxComposer.ComposeRow(item, null, null, AsOf, 24);
        var empty = PartnerInboxComposer.ComposeRow(item, [], PartnerInboxComposer.ReadAcceptance(null), AsOf, 24);

        Assert.False(unread.HistoryRead);
        Assert.Empty(unread.History);
        Assert.Null(unread.Acceptance);
        Assert.Equal("operational", unread.Classification);
        Assert.Empty(unread.Flags);
        Assert.True(empty.HistoryRead);
        Assert.False(empty.Acceptance!.Known);
        await Task.CompletedTask;
    }

    [Fact]
    public async Task TheService_UsesOnlyTheListAndGateReads()
    {
        await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf));

        await _requests.DidNotReceiveWithAnyArgs().CreateLocalAsync(default!, default);
        await _requests.DidNotReceiveWithAnyArgs().ApproveAsync(default, default!, default);
        await _requests.DidNotReceiveWithAnyArgs().RejectAsync(default, default!, default);
        await _requests.DidNotReceiveWithAnyArgs().CancelAsync(default, default!, default);
        await _partner.DidNotReceiveWithAnyArgs().AcceptInboundJobAsync(default);
    }

    [Fact]
    public async Task WithoutTheirClasses_PricePhoneAndFreeTextAreOmitted()
    {
        var o = await _service.GetAsync(new PartnerInboxRequest(AsOf: AsOf, Detail: "all"));
        var text = AgentFieldProjector.Apply(o, new HashSet<string> { AgentCapabilities.ToolPartnerInbox }, costsPermitted: true).ToJsonString();

        Assert.DoesNotContain("132.75", text);
        Assert.DoesNotContain("Two extra drops", text);
        Assert.DoesNotContain("below the agreed lane floor", text);
        Assert.DoesNotContain("\"money\"", text);
    }
}




