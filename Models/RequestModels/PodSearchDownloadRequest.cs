using System;
using System.Collections.Generic;
using System.Linq;

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

    public bool ClientSet => ClientIds != null && ClientIds.Any();
    public bool CourierSet => CourierIds != null && CourierIds.Any();
    public bool SpeedSet => SpeedIds != null && SpeedIds.Any();
}
