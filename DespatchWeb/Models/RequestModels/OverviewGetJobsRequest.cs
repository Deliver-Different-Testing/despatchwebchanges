using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class OverviewGetJobsRequest
{
    public int StatusGroup { get; set; } = 1;
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 20;
    public string Order { get; set; } = "jobName";
    public string Search { get; set; }
    public List<string> Regions { get; set; }
    public DateTime? DateStart { get; set; }
    public DateTime? DateEnd { get; set; }
}