using System.Text.Json.Serialization;
using DespatchWeb.Models.MessageModels;

namespace DespatchWeb.Models.Response;

/// <summary>What the sender of a message wants. Deliberately coarse — the chip only orders attention.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MessageIntent
{
    JobQuery,
    StatusUpdate,
    Problem,
    Availability,
    Pay,
    Admin,
    Other
}

/// <summary>How long a message can wait before the dispatcher has to deal with it.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MessageUrgency
{
    Critical,
    Urgent,
    Soon,
    Routine
}

public sealed record InboxTriageItem
{
    /// <summary>
    /// Identifies the conversation the same way the messaging dialog already does —
    /// the model never sees these, it answers by position in the supplied list.
    /// </summary>
    public int OtherPartyId { get; init; }

    public OtherMessagePartyType OtherPartyType { get; init; }

    public MessageIntent Intent { get; init; }
    public MessageUrgency Urgency { get; init; }
    public string Summary { get; init; }
    public IReadOnlyList<string> JobReferences { get; init; } = [];

    /// <summary>A quick response from the saved catalog that answers this, or null.</summary>
    public int? SuggestedResponseId { get; init; }
}

public sealed record InboxTriageResponse
{
    public IReadOnlyList<InboxTriageItem> Conversations { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}

public sealed record PriceExplanationLine
{
    public string Name { get; init; }
    public decimal Amount { get; init; }
    public string Explanation { get; init; }
}

public sealed record PriceQueryRisk
{
    public string Component { get; init; }

    /// <summary>The evidence in this job that answers the dispute.</summary>
    public string Evidence { get; init; }
}

public sealed record PriceExplanationResponse
{
    public string Headline { get; init; }
    public IReadOnlyList<PriceExplanationLine> Lines { get; init; } = [];
    public IReadOnlyList<PriceQueryRisk> QueryRisks { get; init; } = [];
    public IReadOnlyList<string> Caveats { get; init; } = [];
    public AiUsageInfo Usage { get; init; }
}
