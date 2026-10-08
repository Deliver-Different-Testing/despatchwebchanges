namespace DespatchWeb.Models.RequestModels;

public sealed class BulkReadUpdateRequestModel : BulkUpdateRequestModel
{
    public bool ShouldMarkAsRead { get; init; }
}
