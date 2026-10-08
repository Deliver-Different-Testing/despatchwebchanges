namespace DespatchWeb.Models.Response;

public sealed record BulkPricePreviewRow
{
    public int JobId { get; init; }
    public string JobNo { get; init; } = string.Empty;
    public string Field { get; init; } = string.Empty;
    public decimal OldAmount { get; init; }
    public decimal NewAmount { get; init; }
    public bool IsPrebook { get; init; }

    /// <summary>True when this job was not updated. <see cref="Error"/> carries the reason.</summary>
    public bool Skipped { get; init; }

    public string Error { get; init; }
}
