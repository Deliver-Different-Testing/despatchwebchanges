namespace DespatchWeb.Models.Response;

/// <summary>Body-only AI draft (courier/staff message, job note).</summary>
public sealed record AiDraftResponse
{
    public string Draft { get; init; } = string.Empty;
    public AiUsageInfo Usage { get; init; }
}
