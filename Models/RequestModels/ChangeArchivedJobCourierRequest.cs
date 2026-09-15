namespace DespatchWeb.Models.RequestModels;

public sealed class ChangeArchivedJobCourierRequest
{
    public int JobId { get; set; }
    public int CourierId { get; set; }
}
