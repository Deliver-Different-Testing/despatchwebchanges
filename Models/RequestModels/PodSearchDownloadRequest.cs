using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class PodSearchDownloadRequest
{
    public List<int> CourierIds { get; set; }
    public List<int> ClientIds { get; set; }
    public List<int> SpeedIds { get; set; }
    public string Wild { get; set; }
    public string Job { get; set; }
    public DateTimeOffset FromDate { get; set; }
    public DateTimeOffset ToDate { get; set; }

    public bool ClientSet => ClientIds != null && ClientIds.Count != 0;
    public bool CourierSet => CourierIds != null && CourierIds.Count != 0;
    public bool SpeedSet => SpeedIds != null && SpeedIds.Count != 0;
    public bool WildSet => !string.IsNullOrWhiteSpace(Wild);
    public bool JobSet => !string.IsNullOrWhiteSpace(Job);
}
