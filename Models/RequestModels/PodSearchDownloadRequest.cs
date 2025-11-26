using System;

namespace DespatchWeb.Models.RequestModels;

public class PodSearchDownloadRequest
{
    public int? CourierId { get; set; }
    public int? ClientId { get; set; }
    public int? SpeedId { get; set; }
    public string Wild { get; set; }
    public string Job { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
}