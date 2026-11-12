using System.Text.Json.Nodes;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Models;
using DespatchWeb.Services.AgentRead;

namespace DespatchWeb.Tests.Services.AgentRead;

public class AgentNeutralStringLeakTests
{
    private static readonly IReadOnlySet<string> None = new HashSet<string>();
    private static IReadOnlySet<string> Caps(params string[] caps) => caps.ToHashSet();

    private static string[] Redacted(JsonObject o, string cls) =>
        o["redacted"]?.AsArray().Where(r => (string?)r!["class"] == cls).SelectMany(r => r!["members"]!.AsArray().Select(m => (string)m!)).ToArray() ?? [];

    private static ClassifiedJob Job(decimal? amount) =>
        JobSearchComposer.Classify(new JobDownloadModel { Id = 1, JobNumber = "J1", Amount = amount, ClientReferenceB = "5" }, [new SearchTerm("order", "5")], []);

    [Theory]
    [InlineData(0)]
    [InlineData(null)]
    public void JobSearch_AmountDerivedFlags_GoToPriceFlags_NotNeutralFlags(int? amount)
    {
        var job = Job(amount);
        var a = JobSearchComposer.Assess([job], [], JobSearchComposer.GroupParcels([job]), true, null);

        Assert.DoesNotContain(a.Flags, f => f.Contains("priced $0") || f.Contains("blank Amount"));
        Assert.Single(a.PriceFlags);
    }

    private static JsonObject Story(string title, string? description, params string[] caps)
    {
        var entry = new JourneyEntry(title, description, new DateTimeOffset(2026, 8, 27, 9, 0, 0, TimeSpan.Zero), [], null, "Sam", null);
        var job = new JobFacts(1, "KT1", "Acme", null, null, false, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        return AgentFieldProjector.Apply(JobStoryComposer.Compose(job, [entry], []), caps.ToHashSet(), costsPermitted: true);
    }

    [Theory]
    [InlineData("POD captured", "signed by J Smith")]
    [InlineData("Signature received", null)]
    [InlineData("Photo uploaded", "front door")]
    [InlineData("Proof of delivery recorded", null)]
    public void StoryTimeline_PodEntries_AreHiddenWithoutPod(string title, string? description)
    {
        var json = Story(title, description).ToJsonString();

        Assert.DoesNotContain(title, json);
        if (description is not null) Assert.DoesNotContain(description, json);
        Assert.Contains("agent-see-pod", json);
    }

    [Fact]
    public void StoryTimeline_PodEntry_ShownWithPod_UnderPodDetail_WithFixedLabel()
    {
        var entry = Story("POD captured", "signed by J Smith", AgentCapabilities.SeePod)["timeline"]![0]!.AsObject();

        Assert.Equal("Proof of delivery event", (string?)entry["untrusted_text"]!["what"]);
        Assert.Equal("POD captured: signed by J Smith", (string?)entry["podDetail"]);
    }

    [Theory]
    [InlineData("pod", "agent-see-pod")]
    [InlineData("Proof of delivery recorded", "agent-see-pod")]
    [InlineData("Signature received", "agent-see-pod")]
    [InlineData("signed by Bob", "agent-see-pod")]
    [InlineData("Photograph taken", "agent-see-pod")]
    [InlineData("Image attached", "agent-see-pod")]
    public void TextClassifier_DetectsPod(string text, string expected) =>
        Assert.Contains(expected, AgentFieldProjector.ClassesOfText(text));

    [Theory]
    [InlineData("podName")]
    [InlineData("signedBy")]
    public void FieldClassifier_DetectsPodFieldNames(string field) =>
        Assert.Contains("agent-see-pod", AgentFieldProjector.ClassesOfField(field));

    [Fact]
    public void NeutralStringArrays_DropClassifiedElements_AndListThem()
    {
        var body = new JsonObject
        {
            ["flags"] = new JsonArray("Short-paid by $12.50", "Call bob@example.com", "Photo shows damage", "Plain flag")
        };

        var without = AgentFieldProjector.Apply(body, None, costsPermitted: true);
        Assert.Equal(["Plain flag"], without["flags"]!.AsArray().Select(f => (string)f!).ToArray());
        Assert.Contains("flags[]", Redacted(without, "agent-see-costs"));
        Assert.Contains("flags[]", Redacted(without, "agent-see-contact-details"));
        Assert.Contains("flags[]", Redacted(without, "agent-see-pod"));

        var with = AgentFieldProjector.Apply(body, Caps(AgentCapabilities.SeeCosts, AgentCapabilities.SeeContactDetails, AgentCapabilities.SeePod), costsPermitted: true);
        Assert.Equal(4, with["flags"]!.AsArray().Count);
        Assert.False(with.ContainsKey("redacted"));
    }

    [Theory]
    [InlineData("verdict", "Rebilled $12.50", "agent-see-costs")]
    [InlineData("warnings", "Contact bob@example.com failed", "agent-see-contact-details")]
    [InlineData("message", "Signed by J Smith", "agent-see-pod")]
    public void NeutralStringMembers_AreClassifiedByContent(string member, string text, string cls)
    {
        var body = new JsonObject { [member] = text, ["jobNumber"] = "KT1" };

        var without = AgentFieldProjector.Apply(body, None, costsPermitted: true);
        Assert.False(without.ContainsKey(member));
        Assert.Equal("KT1", (string?)without["jobNumber"]);
        Assert.Contains(member, Redacted(without, cls));

        var with = AgentFieldProjector.Apply(body, Caps(cls), costsPermitted: true);
        Assert.Equal(text, (string?)with[member]);
    }

    [Fact]
    public void CostsNotPermitted_HidesNeutralPriceText_EvenWithTheCapability()
    {
        var body = new JsonObject { ["verdict"] = "Rebilled $12.50" };

        Assert.False(AgentFieldProjector.Apply(body, Caps(AgentCapabilities.SeeCosts), costsPermitted: false).ContainsKey("verdict"));
    }
}
