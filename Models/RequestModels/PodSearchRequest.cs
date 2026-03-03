using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class PodSearchRequest
{
    public List<int> CourierIds { get; init; }
    public List<int> ClientIds { get; init; }
    public List<int> SpeedIds { get; init; }
    public string Wild { get; init; }
    public int? JobId { get; init; }
    public string Job { get; init; }
    public DateTimeOffset FromDate { get; init; }
    public DateTimeOffset ToDate { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
    public string SortColumn { get; init; }
    public string SortDirection { get; init; }

    public bool ClientSet => ClientIds != null && ClientIds.Count != 0;
    public bool CourierSet => CourierIds != null && CourierIds.Count != 0;
    public bool SpeedSet => SpeedIds != null && SpeedIds.Count != 0;
    public bool WildSet => !string.IsNullOrWhiteSpace(Wild);
    public bool JobIdSet => JobId.HasValue;
    public bool JobSet => !string.IsNullOrWhiteSpace(Job);
}
