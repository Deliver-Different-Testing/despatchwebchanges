using System.Collections.Generic;

namespace DespatchWeb.Models.ResponseModels;

public class OverviewJobsResponse
{
    public List<DeliveryJob> Jobs { get; set; }
    public int Total { get; set; }
}