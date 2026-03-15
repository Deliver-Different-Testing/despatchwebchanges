namespace DespatchWeb.Models.RequestModels;

public class PodSearchDownloadRequest
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
