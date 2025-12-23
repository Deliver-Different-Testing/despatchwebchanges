using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class BulkPricePreviewResponse
{
    public List<BulkPricePreviewRow> Rows { get; set; } = [];
    public int TotalJobs { get; set; }
    public decimal TotalOldAmount { get; set; }
    public decimal TotalNewAmount { get; set; }
}

public class BulkPricePreviewRow
{
    public int JobId { get; set; }
    public string JobNo { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public decimal OldAmount { get; set; }
    public decimal NewAmount { get; set; }
    public bool IsPrebook { get; set; }
    public string Error { get; set; }
}
