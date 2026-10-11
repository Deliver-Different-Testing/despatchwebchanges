namespace DespatchWeb.Models.RequestModels;

/// <summary>Request to draft an email subject + body (compose-email dialog).</summary>
public sealed class DraftEmailRequest
{
    public List<string> RecipientNames { get; init; } = [];
    public string SeedSubject { get; init; } = string.Empty;
    public string SeedBody { get; init; } = string.Empty;
}
