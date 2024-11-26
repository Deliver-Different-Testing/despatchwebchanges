using System;

namespace DespatchWeb.Models.RequestModels;

public class OverviewJobsRequest
{
    public int StatusGroup { get; set; } = 1;
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
    public string Search { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string OrderBy { get; set; } = "jobName";
    public string OrderDirection { get; set; } = "asc";
    public string Regions { get; set; } // Comma-separated region IDs
    public string Speeds { get; set; } // Comma-separated speed IDs
}
