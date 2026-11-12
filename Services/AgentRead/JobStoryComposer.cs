#nullable enable
using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DeliverDifferent.AgentAccess;

namespace DespatchWeb.Services.AgentRead;

public sealed record JobFacts(
    int? Id,
    string? Number,
    string? Client,
    string? Speed,
    string? Status,
    bool? Void,
    DateTime? Booked,
    decimal? Amount,
    string? Courier,
    string? PickupAddress,
    int? PickupWindowMinutes,
    DateTime? PickupArrived,
    DateTime? PickedUp,
    string? DeliveryAddress,
    int? DeliveryWindowMinutes,
    DateTime? DeliveryArrived,
    DateTime? Completed,
    string? SignedBy,
    DateTime? Dispatched,
    string? Reference);

public sealed record JourneyEntry(
    string Title,
    string? Description,
    DateTimeOffset Date,
    IReadOnlyList<string> Tags,
    decimal? GrandTotalAfter,
    string? PerformedBy,
    string? Icon);

public sealed record NoteFacts(int Id, string? Type, string? Text, bool Important, string? CreatedBy, DateTimeOffset? CreatedAt, DateTimeOffset? UpdatedAt);

/// <summary>
/// The job_story composition ported from the prototype: job clocks, a chronological timeline with bookkeeping dropped and
/// gaps between entries, price events, notes and the flags a dispatcher would point out.
/// </summary>
public static partial class JobStoryComposer
{
    [GeneratedRegex("cubic", RegexOptions.IgnoreCase)]
    private static partial Regex Cubic();

    [GeneratedRegex("internal pricing", RegexOptions.IgnoreCase)]
    private static partial Regex InternalPricing();

    [GeneratedRegex("note (edit|updat|rewrit)", RegexOptions.IgnoreCase)]
    private static partial Regex NoteEdit();

    [GeneratedRegex(@"PPD Amount:\s*(.+?)\s*(?:→|->)\s*\1\s*$")]
    private static partial Regex PpdNoop();

    [GeneratedRegex("completed|delivered", RegexOptions.IgnoreCase)]
    private static partial Regex DeliveryWord();

    [GeneratedRegex("sms|email", RegexOptions.IgnoreCase)]
    private static partial Regex MessageWord();

    [GeneratedRegex("on its way|picked up", RegexOptions.IgnoreCase)]
    private static partial Regex OnItsWay();

    public static bool IsBookkeeping(JourneyEntry entry)
    {
        var text = $"{entry.Title} {entry.Description}";
        return Cubic().IsMatch(text) || InternalPricing().IsMatch(text) || NoteEdit().IsMatch(text) || PpdNoop().IsMatch(text);
    }

    public sealed record Shaped(JourneyEntry Entry, int? GapMinutes, bool OutOfSequence);

    /// <summary>The journey arrives newest first; it reads forwards, so reverse, filter and compute gaps.</summary>
    public static (List<Shaped> Entries, int Dropped) ShapeJourney(IReadOnlyList<JourneyEntry> newestFirst)
    {
        var chronological = newestFirst.Reverse().ToList();
        var kept = chronological.Where(e => !IsBookkeeping(e)).ToList();
        DateTimeOffset? previous = null;
        List<Shaped> entries = [];
        foreach (var entry in kept)
        {
            int? gap = previous is null ? null : (int)Math.Round((entry.Date - previous.Value).TotalMinutes, MidpointRounding.AwayFromZero);
            entries.Add(new Shaped(entry, gap, previous is not null && entry.Date < previous));
            previous = entry.Date;
        }

        return (entries, chronological.Count - kept.Count);
    }

    public static JsonObject Compose(JobFacts job, IReadOnlyList<JourneyEntry> journeyNewestFirst, IReadOnlyList<NoteFacts> notes)
    {
        var (shaped, dropped) = ShapeJourney(journeyNewestFirst);
        var timeline = new JsonArray([.. shaped.Select(s => (JsonNode)TimelineEntry(s))]);
        var events = new JsonArray([.. shaped.Where(s => s.Entry.GrandTotalAfter is not null).Select(s => (JsonNode)new JsonObject
        {
            ["at"] = Local(s.Entry.Date),
            [MemberFor(ClassesOf(s.Entry.Title, s.Entry.Description, true))] = string.IsNullOrEmpty(s.Entry.Description) ? s.Entry.Title : $"{s.Entry.Title} — {s.Entry.Description}",
            ["totalAfter"] = s.Entry.GrandTotalAfter
        })]);

        List<string> flags = [];
        List<string> priceFlags = [];
        if (job.Void == true) flags.Add("VOID — this job was voided; nothing below is billable");
        if (job.Completed is not null && string.IsNullOrWhiteSpace(job.SignedBy)) flags.Add("Completed with no POD name — check who signed before billing");
        if (job.PickedUp is { } pu && job.Dispatched is { } dispatched && pu < dispatched) flags.Add("Picked up before it was dispatched — clock or status order is wrong");
        if (shaped.Any(s => s.OutOfSequence)) flags.Add("Journey has an out-of-sequence entry — read the timeline, not the last line");
        var delivered = shaped.FindIndex(s => DeliveryWord().IsMatch(s.Entry.Title));
        if (delivered >= 0 && shaped.Skip(delivered + 1).Any(s => MessageWord().IsMatch(s.Entry.Title) && OnItsWay().IsMatch(s.Entry.Description ?? "")))
        {
            flags.Add("A 'on its way' message was sent AFTER delivery — customer-facing message out of order");
        }

        if (job.Amount == 0) priceFlags.Add("Amount is $0 — a postcode in no zone or a manual price never entered");

        var noteItems = new JsonArray([.. notes.Select(n => (JsonNode)new JsonObject
        {
            ["id"] = n.Id,
            ["type"] = n.Type,
            ["text"] = n.Text,
            ["important"] = n.Important,
            ["createdBy"] = n.CreatedBy,
            ["createdAt"] = n.CreatedAt is { } c ? Local(c) : null,
            ["updatedAt"] = n.UpdatedAt is { } u ? Local(u) : null
        })]);

        return new JsonObject
        {
            ["found"] = true,
            ["job"] = new JsonObject
            {
                ["id"] = job.Id,
                ["number"] = job.Number,
                ["client"] = job.Client,
                ["speed"] = job.Speed,
                ["status"] = job.Status,
                ["void"] = job.Void,
                ["booked"] = Local(job.Booked),
                ["amount"] = job.Amount,
                ["courier"] = job.Courier,
                ["pickup"] = new JsonObject
                {
                    ["address"] = job.PickupAddress,
                    ["windowMinutes"] = job.PickupWindowMinutes,
                    ["arrived"] = Local(job.PickupArrived),
                    ["pickedUp"] = Local(job.PickedUp)
                },
                ["delivery"] = new JsonObject
                {
                    ["address"] = job.DeliveryAddress,
                    ["windowMinutes"] = job.DeliveryWindowMinutes,
                    ["arrived"] = Local(job.DeliveryArrived),
                    ["completed"] = Local(job.Completed),
                    ["signedBy"] = job.SignedBy
                },
                ["dispatched"] = Local(job.Dispatched),
                ["reference"] = job.Reference
            },
            ["timeline"] = timeline,
            ["price"] = new JsonObject { ["amount"] = job.Amount, ["events"] = events },
            ["notes"] = new JsonObject { ["count"] = notes.Count, ["items"] = noteItems },
            ["flags"] = AgentJobSearchService.Strings(flags),
            ["priceFlags"] = AgentJobSearchService.Strings(priceFlags),
            ["droppedBookkeeping"] = dropped
        };
    }

    // Title and description are classified together (names, literal emails/phones, amounts). A classified entry keeps its
    // text out of `what`/`detail` and puts it in the member that carries its class, so a role without that class never sees it.
    private static JsonObject TimelineEntry(Shaped s)
    {
        var e = s.Entry;
        var entry = new JsonObject
        {
            ["at"] = Local(e.Date),
            ["by"] = e.PerformedBy,
            ["gapMinutes"] = s.GapMinutes,
            ["outOfSequence"] = s.OutOfSequence
        };

        var classes = ClassesOf(e.Title, e.Description, e.GrandTotalAfter is not null);
        var freeText = e.Icon is "sticky_note_2" or "sms" or "task" || e.Tags.Contains("Note", StringComparer.OrdinalIgnoreCase);
        if (freeText && !classes.Contains(AgentCapabilities.SeeNotes)) classes.Add(AgentCapabilities.SeeNotes);

        if (classes.Count == 0)
        {
            entry["what"] = e.Title;
            entry["detail"] = e.Description;
            return entry;
        }

        entry["what"] = freeText ? e.Icon switch { "sms" => "Message", "task" => "Task", _ => "Note" }
            : classes.Count > 1 ? "Restricted event"
            : classes[0] switch { AgentCapabilities.SeeCosts => "Price event", AgentCapabilities.SeeContactDetails => "Contact detail event", _ => "Note" };
        entry[MemberFor(classes)] = string.IsNullOrEmpty(e.Description) ? e.Title : $"{e.Title}: {e.Description}";
        return entry;
    }

    private static List<string> ClassesOf(string title, string? description, bool priced)
    {
        var classes = AgentFieldProjector.ClassesOfText(title, description).ToList();
        if (priced && !classes.Contains(AgentCapabilities.SeeCosts)) classes.Add(AgentCapabilities.SeeCosts);
        return classes;
    }

    private static string MemberFor(IReadOnlyCollection<string> classes) =>
        classes.Count == 1 && classes.Contains(AgentCapabilities.SeeNotes) ? "noteText" : AgentFieldProjector.StemFor(classes) + "Detail";
    public static string? Local(DateTime? value) => value?.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);

    public static string Local(DateTimeOffset value) => value.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
}

