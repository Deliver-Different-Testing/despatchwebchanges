using System;

namespace DespatchWeb.Models.RequestModels;

public class PodSearchRequest
{
    public int? CourierId { get; set; }
    public int? ClientId { get; set; }
    public string Wild { get; set; }
    public string Job { get; set; }
    public DateTimeOffset FromDate { get; set; }
    public DateTimeOffset ToDate { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    
    public bool ClientSet => ClientId.HasValue;
    public bool CourierSet => CourierId.HasValue;
    public bool WildSet => !string.IsNullOrWhiteSpace(Wild);
    public bool JobSet => !string.IsNullOrWhiteSpace(Job);
}
