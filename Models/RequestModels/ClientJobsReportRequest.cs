using System;

namespace DespatchWeb.Models.RequestModels;

public class ClientJobsReportRequest
{
    public DateTimeOffset StartDate { get; set; }
    public DateTimeOffset EndDate { get; set; }
    public int? ClientId { get; set; }
}
