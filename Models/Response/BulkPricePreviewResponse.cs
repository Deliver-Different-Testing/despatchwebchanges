namespace DespatchWeb.Models.Response;

public sealed record BulkPricePreviewResponse
{
    public IReadOnlyList<BulkPricePreviewRow> Rows { get; init; } = [];

    /// <summary>Number of jobs whose price was actually updated.</summary>
    public int TotalJobs { get; init; }

    /// <summary>Number of jobs from the file that could not be updated (not found, locked, or unsupported in this mode).</summary>
    public int SkippedJobs { get; init; }

    /// <summary>Old-amount total across the jobs that were actually updated.</summary>
    public decimal TotalOldAmount { get; init; }

    /// <summary>New-amount total across the jobs that were actually updated.</summary>
    public decimal TotalNewAmount { get; init; }
}
