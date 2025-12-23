using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class ClientJobsReportRequest
{
    public DateTimeOffset StartDate { get; set; }
    public DateTimeOffset EndDate { get; set; }
    public List<int> ClientIds { get; set; } = [];
}
