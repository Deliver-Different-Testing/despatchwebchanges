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
