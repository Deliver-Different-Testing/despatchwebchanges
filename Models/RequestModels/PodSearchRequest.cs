using System;

namespace DespatchWeb.Models.RequestModels;

public class PodSearchRequest
{
    public int? CourierId { get; set; }
    public int? ClientId { get; set; }
    public string Wild { get; set; }
    public string Job { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
}
