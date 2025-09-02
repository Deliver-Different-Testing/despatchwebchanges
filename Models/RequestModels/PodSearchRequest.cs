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
    
    public bool ClientSet => ClientId.HasValue;
    public bool CourierSet => CourierId.HasValue;
    public bool WildSet => !string.IsNullOrWhiteSpace(Wild);
    public bool JobSet => !string.IsNullOrWhiteSpace(Job);
}
