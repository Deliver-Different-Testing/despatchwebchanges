namespace DespatchWeb.Models.RequestModels;

// Filter for the Price Detail Report export. Mirrors PodSearchDownloadRequest field-for-field so
// the export selects exactly what the job-search grid shows. The report always runs the FULL
// filtered set - Page/PageSize are deliberately absent.
public sealed class PriceDetailReportRequest
{
    public List<int> CourierIds { get; init; }
    public List<int> ClientIds { get; init; }
    public List<int> SpeedIds { get; init; }
    public string Wild { get; init; }
    public int? JobId { get; init; }
    public string Job { get; init; }
    public DateTimeOffset FromDate { get; init; }
    public DateTimeOffset ToDate { get; init; }
}
