using System;
using System.Collections.Generic;

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

public class OpenJobsRequest : BaseOverviewRequest;

public class BaseOverviewRequest
{
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<int> Regions { get; set; } = [];
    public List<int> Speeds { get; set; } = [];
    public List<int> Couriers { get; set; } = [];
}
