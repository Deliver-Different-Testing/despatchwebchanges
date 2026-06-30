using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models.RequestModels;

/// <summary>Request to draft a courier/staff message body.</summary>
public sealed class DraftMessageRequest
{
    public string RecipientName { get; init; } = string.Empty;
    public OtherMessagePartyType RecipientType { get; init; }

    /// <summary>Delivery channel: 1 = App, 2 = SMS, 3 = Smart. Controls length/tone.</summary>
    public int MessageType { get; init; }

    /// <summary>Rough text the user already typed; the draft polishes/expands it. May be empty.</summary>
    public string Seed { get; init; } = string.Empty;

    /// <summary>Optional recent thread lines (oldest first) for context.</summary>
    public List<string> RecentMessages { get; init; } = [];

    /// <summary>Optional job to pull context from.</summary>
    public int? JobId { get; init; }
}

/// <summary>Request to draft an email subject + body (compose-email dialog).</summary>
public sealed class DraftEmailRequest
{
    public List<string> RecipientNames { get; init; } = [];
    public string SeedSubject { get; init; } = string.Empty;
    public string SeedBody { get; init; } = string.Empty;
}

/// <summary>Request to draft a job note of a chosen type.</summary>
public sealed class DraftNoteRequest
{
    public int? JobId { get; init; }
    public int? JobBookingId { get; init; }
    public int? BulkJobId { get; init; }

    /// <summary>NoteType enum value — drives audience/tone (Client/Agent vs Internal).</summary>
    public int NoteTypeId { get; init; }

    /// <summary>Rough text the user already typed; the draft polishes/expands it. May be empty.</summary>
    public string Seed { get; init; } = string.Empty;
}
