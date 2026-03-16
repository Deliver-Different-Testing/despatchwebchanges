namespace DespatchWeb.Models.RequestModels;

public class BulkUpdateRequestModel
{ 
    public List<int> JobIds { get; init; }
}

public sealed class BulkReadUpdateRequestModel : BulkUpdateRequestModel
{
    public bool ShouldMarkAsRead { get; init; }
}