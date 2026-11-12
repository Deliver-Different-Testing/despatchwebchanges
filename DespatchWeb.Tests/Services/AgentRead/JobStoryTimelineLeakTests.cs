using System.Text.Json.Nodes;
using DeliverDifferent.AgentAccess;
using DespatchWeb.Services.AgentRead;

namespace DespatchWeb.Tests.Services.AgentRead;

public class JobStoryTimelineLeakTests
{
    private static readonly IReadOnlySet<string> None = new HashSet<string>();

    private static JsonObject Project(string title, string? description, decimal? total = null, string? icon = null, params string[] caps)
    {
        var entry = new JourneyEntry(title, description, new DateTimeOffset(2026, 8, 27, 9, 0, 0, TimeSpan.Zero), [], total, "Sam", icon);
        var job = new JobFacts(1, "KT1", "Acme", null, null, false, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        var story = JobStoryComposer.Compose(job, [entry], []);
        return AgentFieldProjector.Apply(story, caps.ToHashSet(), costsPermitted: true);
    }

    private static string Everything(JsonObject o) => o.ToJsonString();

    [Theory]
    [InlineData("Surcharge added", "Waiting time 12.50")]
    [InlineData("Discount applied", "10% off")]
    [InlineData("GST recalculated", null)]
    [InlineData("Invoice raised", "INV-1001")]
    [InlineData("Details updated", "Total changed to $45")]
    public void PriceText_IsNotShownWithoutCosts(string title, string? description)
    {
        var json = Everything(Project(title, description));

        Assert.DoesNotContain(title, json);
        if (description is not null) Assert.DoesNotContain(description, json);
        Assert.Contains("agent-see-costs", json);
    }

    [Theory]
    [InlineData("Receiver details changed", "bob@example.com")]
    [InlineData("Contact updated", "021 555 0100")]
    [InlineData("Tel changed", "to 09 555 0100")]
    [InlineData("Fax updated", null)]
    public void ContactText_IsNotShownWithoutContactDetails(string title, string? description)
    {
        var json = Everything(Project(title, description));

        Assert.DoesNotContain(title, json);
        if (description is not null) Assert.DoesNotContain(description, json);
        Assert.Contains("agent-see-contact-details", json);
    }

    [Fact]
    public void ClassifiedText_IsShownWithItsCapability_AndNeverInWhat()
    {
        var o = Project("Surcharge added", "12.50", caps: AgentCapabilities.SeeCosts);

        var entry = o["timeline"]![0]!.AsObject();
        Assert.Equal("Price event", (string?)entry["untrusted_text"]!["what"]);
        Assert.Equal("Surcharge added: 12.50", (string?)entry["priceDetail"]);
    }

    [Fact]
    public void TextWithPriceAndPhone_NeedsBothCapabilities()
    {
        var onlyCosts = Everything(Project("Refund", "$5 to 021 555 0100", caps: AgentCapabilities.SeeCosts));
        var onlyContact = Everything(Project("Refund", "$5 to 021 555 0100", caps: AgentCapabilities.SeeContactDetails));

        Assert.DoesNotContain("021 555 0100", onlyCosts);
        Assert.DoesNotContain("021 555 0100", onlyContact);
    }

    [Fact]
    public void PlainText_StaysInWhatAndDetail()
    {
        var entry = Project("Job booked", "via web")["timeline"]![0]!.AsObject();

        Assert.Equal("Job booked", (string?)entry["untrusted_text"]!["what"]);
        Assert.Equal("via web", (string?)entry["untrusted_text"]!["detail"]);
    }

    [Fact]
    public void PriceEvents_DoNotCarryPhoneNumbersToACallerWithoutContactDetails()
    {
        var json = Everything(Project("Price changed", "call 021 555 0100", total: 12m, caps: AgentCapabilities.SeeCosts));

        Assert.DoesNotContain("021 555 0100", json);
    }

    [Fact]
    public void FieldClassification_UsesTheSharedVocabulary()
    {
        var o = new JsonObject();
        PartnerInboxComposer.AddValues(o, "DeliveryTel", "09 111 2222", "09 333 4444");
        Assert.True(o.ContainsKey("phoneOrEmailFrom"));

        o = [];
        PartnerInboxComposer.AddValues(o, "SurchargeTotal", "1", "2");
        Assert.True(o.ContainsKey("priceFrom"));

        o = [];
        PartnerInboxComposer.AddValues(o, "DeliveryInstructions", "a", "b");
        Assert.True(o.ContainsKey("notesFrom"));

        o = [];
        PartnerInboxComposer.AddValues(o, "DeliveryDate", "a", "b");
        Assert.True(o.ContainsKey("from"));
    }
}
