namespace DespatchWeb.Models.RequestModels;

public sealed class VoidJobRequest : VoidJobBaseRequest
{
    public int JobId { get; init; }
    public List<int> SelectedJobIds { get; init; }
}
