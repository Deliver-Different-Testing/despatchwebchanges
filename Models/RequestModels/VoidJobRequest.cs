namespace DespatchWeb.Models.RequestModels;

public sealed class VoidJobRequest : VoidJobBaseRequest
{
    public int JobId { get; init; }
    public List<int> SelectedJobIds { get; init; }

    /// <summary>tblBulkJob ids, kept apart from <see cref="SelectedJobIds"/> because the two id spaces overlap.</summary>
    public List<int> SelectedBulkJobIds { get; init; }
}
