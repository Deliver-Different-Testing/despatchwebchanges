namespace DespatchWeb.Models;

public readonly record struct ScanDetailResult
{
    public int BulkScanId { get; init; }
    public DateTime ScanDateTime { get; init; }
    public string ScanDetail { get; init; }
    public string Courier { get; init; }
}
