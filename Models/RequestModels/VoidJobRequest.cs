namespace DespatchWeb.Models.RequestModels;

public class VoidJobRequest : VoidJobBaseRequest
{
    public int JobId { get; init; }
    public List<int> SelectedJobIds { get; init; }
}

public class VoidBulkJobRequest : VoidJobBaseRequest
{
    public int BulkJobId { get; init; }
    public List<int> SelectedJobIds { get; init; }
}

public class VoidJobBaseRequest
{
    public bool VoidSingleJobOnly { get; init; }
    public string VoidReason { get; init; }
}