using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class NationwideJobsRequestModel : JobQueryParams
{
    public  bool IsInternal { get; set; }
    public int Cid { get; set; }
    public string ClientIds { get; set; }
    public List<int> DespatchViewIds { get; set; }
}