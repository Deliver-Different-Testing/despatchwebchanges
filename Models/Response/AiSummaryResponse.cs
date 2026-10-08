namespace DespatchWeb.Models.Response;

public sealed record AiSummaryResponse
{
    public string Summary { get; init; }
    public AiUsageInfo Usage { get; init; }
}
