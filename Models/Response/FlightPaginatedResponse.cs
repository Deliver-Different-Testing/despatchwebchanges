using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class FlightPaginationResult
{
    public List<FlightViewModel> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int PageIndex { get; set; }
    public int PageSize { get; set; }
    public DateTime? LastDepartureTime { get; set; }
}
