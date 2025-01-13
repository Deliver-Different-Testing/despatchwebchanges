using System;

namespace DespatchWeb.Models.RequestModels;

public class OverviewJobsRequest : BaseOverviewRequest
{
    public int StatusGroup { get; set; } = 1;
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
    public string Search { get; set; }
    public string OrderBy { get; set; } = "jobName";
    public string OrderDirection { get; set; } = "asc";
}

public class OpenJobsRequest : BaseOverviewRequest
{
}

public class BaseOverviewRequest
{
    public DateTime? StartDate { get; }
    public DateTime? EndDate { get; set; }
    public string Regions { get; set; } // Comma-separated region IDs
    public string Speeds { get; set; } // Comma-separated speed IDs
}