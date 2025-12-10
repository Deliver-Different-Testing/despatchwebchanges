using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class VoidJobRequest : VoidJobBaseRequest
{
    public int JobId { get; set; }
    public List<int> SelectedJobIds { get; set; }
}

public class VoidBulkJobRequest : VoidJobBaseRequest
{
    public int BulkJobId { get; set; }
    public List<int> SelectedJobIds { get; set; }
}

public class VoidJobBaseRequest
{
    public bool VoidSingleJobOnly { get; set; }
    public string VoidReason { get; set; }
}