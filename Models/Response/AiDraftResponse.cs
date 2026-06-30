namespace DespatchWeb.Models.Response;

/// <summary>Body-only AI draft (courier/staff message, job note).</summary>
public sealed record AiDraftResponse
{
    public string Draft { get; init; } = string.Empty;
    public AiUsageInfo Usage { get; init; }
}

/// <summary>Subject + body AI draft (POD delivery email, compose email).</summary>
public sealed record AiEmailDraftResponse
{
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public AiUsageInfo Usage { get; init; }
}
