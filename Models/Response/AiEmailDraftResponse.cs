namespace DespatchWeb.Models.Response;

/// <summary>Subject + body AI draft (POD delivery email, compose email).</summary>
public sealed record AiEmailDraftResponse
{
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public AiUsageInfo Usage { get; init; }
}
