using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using DespatchWeb.Services.AgentRead;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

// Parity with dfrntmcp prototype-ts/proposed/job_story (job_story.test.ts).
public class AgentJobStoryServiceTests : IAsyncDisposable
{
    private static readonly JsonObject Fixture = AgentFixture.Load("job_story");

    private readonly SqliteTestDatabase _db = new();
    private readonly IJobQueryRepository _jobs = Substitute.For<IJobQueryRepository>();
    private readonly INoteRepository _notes = Substitute.For<INoteRepository>();

    private static JobFacts FactsFrom(JsonObject detail)
    {
        var j = detail["job"]?.AsObject() ?? detail;
        DateTime? Dt(string k) => j[k] is { } v && v.GetValueKind() == JsonValueKind.String ? DateTime.Parse((string)v!, CultureInfo.InvariantCulture) : null;
        return new JobFacts(
            (int?)j["jobId"], (string?)j["jobNumber"], (string?)j["client"], (string?)j["speed"], (string?)j["statusName"],
            (bool?)j["void"], null, (decimal?)j["amount"], null, null, (int?)j["pickupTime"], Dt("pickupArrivalTime"), Dt("puTime"),
            null, (int?)j["deliveryTime"], Dt("deliveryArrivalTime"), Dt("completedTime"), (string?)j["podName"], Dt("dispatchTime"), null);
    }

    private static IReadOnlyList<JourneyEntry> JourneyFrom(JsonNode journey) =>
        [.. journey.AsArray().Select(e => new JourneyEntry(
            (string)e!["title"]!, (string?)e["description"],
            DateTimeOffset.Parse((string)e["date"]!, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal),
            [.. e["tags"]!.AsArray().Select(t => (string)t!)], (decimal?)e["grandTotalAfter"], null, null))];

    private static JsonObject ComposeFixture() =>
        JobStoryComposer.Compose(FactsFrom(Fixture["detail"]!.AsObject()), JourneyFrom(Fixture["journey"]!), []);

    private static string[] Flags(JsonObject o) => [.. o["flags"]!.AsArray().Select(f => (string)f!)];

    [Fact]
    public void TheStory_ReadsTheClockFieldsTheRecordHas_AndOrdersTheTimelineForwards()
    {
        var o = ComposeFixture();

        Assert.Equal("KT1176OTG", (string?)o["job"]!["number"]);
        Assert.Equal("Daniela Rangel", (string?)o["job"]!["delivery"]!["signedBy"]);
        Assert.Equal(240, (int)o["job"]!["pickup"]!["windowMinutes"]!);
        Assert.Equal("2026-07-21T09:32:46", (string?)o["job"]!["pickup"]!["pickedUp"]);
        Assert.Equal("Accepted", (string?)o["timeline"]![0]!["what"]);
        Assert.Equal("SMS sent", (string?)o["timeline"]!.AsArray().Last()!["what"]);
        Assert.True((int)o["droppedBookkeeping"]! >= 1);
        Assert.Contains(Flags(o), f => f.Contains("AFTER delivery"));
    }

    [Fact]
    public void PriceEvents_AreTheJourneyRowsWhereTheTotalMoved_AndANoOpPpdRowIsBookkeeping()
    {
        Assert.Empty(ComposeFixture()["price"]!["events"]!.AsArray());

        var moved = new JourneyEntry("Pricing", "Amount: 10 → 12", DateTimeOffset.Parse("2026-07-21T09:00:00Z", CultureInfo.InvariantCulture), [], 12m, null, null);
        var events = JobStoryComposer.Compose(FactsFrom(JsonNode.Parse("""{ "job": {} }""")!.AsObject()), [moved], [])["price"]!["events"]!.AsArray();

        Assert.Equal(12m, (decimal)Assert.Single(events)!["totalAfter"]!);
    }
    [Fact]
    public void AVoidJob_AndACompletedJobWithNoPodName_AreFlagged()
    {
        var o = JobStoryComposer.Compose(
            FactsFrom(JsonNode.Parse("""{ "job": { "void": true, "completedTime": "2026-07-21T10:30:00", "podName": null } }""")!.AsObject()), [], []);

        Assert.Contains(Flags(o), f => f.Contains("VOID"));
        Assert.Contains(Flags(o), f => f.Contains("no POD name"));
    }

    [Fact]
    public void AZeroAmount_IsAPriceFlag_SoItIsRedactedWithTheCosts()
    {
        var o = JobStoryComposer.Compose(FactsFrom(JsonNode.Parse("""{ "job": { "amount": 0 } }""")!.AsObject()), [], []);
        var projected = AgentFieldProjector.Apply(o, new HashSet<string>(), costsPermitted: true);

        Assert.DoesNotContain(Flags(o), f => f.Contains("$0"));
        Assert.False(projected.ContainsKey("priceFlags"));
        Assert.False(projected["job"]!.AsObject().ContainsKey("amount"));
        Assert.False(projected.ContainsKey("price"));
    }

    [Fact]
    public void FreeTextAndPriceJourneyText_DoNotSurviveAnEmptyCapabilitySet()
    {
        var journey = new JourneyEntry[]
        {
            new("Note added by Sam", "gate code 1234", DateTimeOffset.Parse("2026-07-21T10:00:00Z", CultureInfo.InvariantCulture), ["Note"], null, "Sam", "sticky_note_2"),
            new("Pricing", "Amount: 10 → 12", DateTimeOffset.Parse("2026-07-21T09:00:00Z", CultureInfo.InvariantCulture), [], 12m, null, null)
        };
        var o = JobStoryComposer.Compose(FactsFrom(JsonNode.Parse("""{ "job": {} }""")!.AsObject()), journey, []);

        var text = AgentFieldProjector.Apply(o, new HashSet<string>(), costsPermitted: true).ToJsonString();

        Assert.DoesNotContain("gate code", text);
        Assert.DoesNotContain("10 → 12", text);
    }

    [Fact]
    public async Task ANumberThatMatchesNoJob_IsNotFound_NotGuessed()
    {
        _jobs.GetJobIdByNumberAsync("NOPE1").Returns((int?)null);
        var service = new AgentJobStoryService(_jobs, _notes, Substitute.For<IDeliveryJourneyService>());

        var o = await service.GetAsync("NOPE1", null);

        Assert.False((bool)o["found"]!);
    }

    [Fact]
    public async Task AJobId_SkipsTheNumberLookup()
    {
        var journey = Substitute.For<IDeliveryJourneyService>();
        journey.GetDeliveryJourneyForJobAsync(7).Returns([]);
        _jobs.GetJobWithoutMarkingReadAsync(7).Returns(new JobViewModel { Id = 7, JobNo = "X" });
        _notes.GetNotesByJobIdAsync(7).Returns([]);

        var o = await new AgentJobStoryService(_jobs, _notes, journey).GetAsync(null, 7);

        Assert.True((bool)o["found"]!);
        await _jobs.DidNotReceiveWithAnyArgs().GetJobIdByNumberAsync(default!);
    }

    [Fact]
    public async Task ReadingAJobStory_WritesNothing_NotTheReadMarkerNorAPendingWebQuantityChange()
    {
        await using (var seed = _db.CreateContext())
        {
            seed.TucJobs.Add(new TucJob { UcjbId = 1, UcjbQty = 1 });
            seed.JobDeliveryJourneys.Add(new JobDeliveryJourney
            {
                JobId = 1, FieldName = "ucjbQty", NewValue = "5", UpdatedByType = "Customer", UpdatedAt = new DateTime(2026, 7, 1), ChangeType = "JobUpdate"
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var guard = new ReadOnlyGuard();
        var tenant = Substitute.For<ITenantInfoService>();
        tenant.GetTenantTimeZone().Returns("UTC");
        tenant.ConvertUtcToTenantTimeZone(Arg.Any<DateTime>()).Returns(ci => new DateTimeOffset(ci.Arg<DateTime>(), TimeSpan.Zero));
        _jobs.GetJobWithoutMarkingReadAsync(1).Returns(new JobViewModel { Id = 1, JobNo = "J1" });
        _notes.GetNotesByJobIdAsync(1).Returns([]);
        var service = new AgentJobStoryService(_jobs, _notes, new DeliveryJourneyService(guard.Factory(_db), tenant));

        var o = await service.GetAsync(null, 1);

        Assert.True((bool)o["found"]!);
        Assert.Empty(guard.Writes);
        await using var check = _db.CreateContext();
        Assert.Equal<short?>(1, (await check.TucJobs.SingleAsync(TestContext.Current.CancellationToken)).UcjbQty);
        Assert.Single(await check.JobDeliveryJourneys.ToListAsync(TestContext.Current.CancellationToken));
        await _jobs.DidNotReceiveWithAnyArgs().GetJobByIdAsync(default);
        await _jobs.DidNotReceiveWithAnyArgs().GetSingleJobById(default);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }
}
