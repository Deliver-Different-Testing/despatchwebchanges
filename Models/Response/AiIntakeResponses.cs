namespace DespatchWeb.Models.Response;

/// <summary>
/// A name the model read out of the source, and the record the application matched it
/// to. <see cref="Id"/> is null when nothing matched — the operator picks it themselves
/// rather than the model inventing one.
/// </summary>
public sealed record AiResolvedLookup
{
    /// <summary>The wording the source used.</summary>
    public string Text { get; init; }

    public int? Id { get; init; }

    /// <summary>The matched record's own name, which may differ from <see cref="Text"/>.</summary>
    public string Name { get; init; }
}

/// <summary>
/// The eight numbered address lines, which mean different things on US and NZ tenants
/// — see <c>AddressViewModel</c> on the client.
/// </summary>
public sealed record AiIntakeAddress
{
    public string AddressLine1 { get; init; }
    public string AddressLine2 { get; init; }
    public string AddressLine3 { get; init; }
    public string AddressLine4 { get; init; }
    public string AddressLine5 { get; init; }
    public string AddressLine6 { get; init; }
    public string AddressLine7 { get; init; }
    public string AddressLine8 { get; init; }
}

public sealed record JobIntakeResponse
{
    public AiIntakeAddress PickupAddress { get; init; }
    public AiIntakeAddress DeliveryAddress { get; init; }
    public AiResolvedLookup Client { get; init; }
    public AiResolvedLookup Speed { get; init; }
    public AiResolvedLookup Vehicle { get; init; }
    public string FromContactName { get; init; }
    public string DeliverToContact { get; init; }
    public string PodName { get; init; }

    /// <summary>ISO yyyy-MM-dd, or null when the source named no date.</summary>
    public string Date { get; init; }

    public string RefA { get; init; }
    public string RefB { get; init; }
    public string PickupNotes { get; init; }
    public string DeliveryNotes { get; init; }
    public string JobNotes { get; init; }
    public decimal? Weight { get; init; }

    /// <summary>"kg" or "lb", or null when the source gave a number with no unit.</summary>
    public string WeightUnit { get; init; }

    public double Confidence { get; init; }

    /// <summary>What a human still has to decide. The operator reads this first.</summary>
    public IReadOnlyList<string> Unresolved { get; init; } = [];

    public AiUsageInfo Usage { get; init; }
}

/// <summary>A word of the search query that did not become a criterion, and why.</summary>
public sealed record AiIgnoredTerm
{
    public string Term { get; init; }
    public string Reason { get; init; }
}

public sealed record SearchCriteriaResponse
{
    public IReadOnlyList<Suggestion> Clients { get; init; } = [];
    public IReadOnlyList<Suggestion> Couriers { get; init; } = [];
    public IReadOnlyList<Suggestion> Speeds { get; init; } = [];
    public int? JobId { get; init; }
    public int? BulkJobId { get; init; }
    public string JobNumber { get; init; }
    public string Wildcard { get; init; }

    /// <summary>ISO yyyy-MM-dd.</summary>
    public string FromDate { get; init; }

    public string ToDate { get; init; }

    public IReadOnlyList<AiIgnoredTerm> Ignored { get; init; } = [];

    /// <summary>
    /// Names the model read that no client, courier or speed matched. Shown to the
    /// dispatcher so a mis-read name is visible rather than silently dropped.
    /// </summary>
    public IReadOnlyList<string> UnmatchedNames { get; init; } = [];

    public AiUsageInfo Usage { get; init; }
}
