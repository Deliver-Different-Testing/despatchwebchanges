namespace DespatchWeb.Models.Response;

public sealed record BulkPricePreviewResponse
{
    public IReadOnlyList<BulkPricePreviewRow> Rows { get; init; } = [];
    public int TotalJobs { get; init; }
    public decimal TotalOldAmount { get; init; }
    public decimal TotalNewAmount { get; init; }
}

public sealed record BulkPricePreviewRow
{
    public int JobId { get; init; }
    public string JobNo { get; init; } = string.Empty;
    public string Field { get; init; } = string.Empty;
    public decimal OldAmount { get; init; }
    public decimal NewAmount { get; init; }
    public bool IsPrebook { get; init; }
    public string Error { get; init; }
}
