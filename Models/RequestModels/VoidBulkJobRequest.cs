namespace DespatchWeb.Models.RequestModels;

public sealed class VoidBulkJobRequest : VoidJobBaseRequest
{
    public int BulkJobId { get; init; }
    public List<int> SelectedJobIds { get; init; }
}
