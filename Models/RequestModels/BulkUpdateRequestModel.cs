using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class BulkUpdateRequestModel
{ 
    public List<int> JobIds { get; set; }
}

public class BulkReadUpdateRequestModel : BulkUpdateRequestModel
{
    public bool ShouldMarkAsRead { get; set; }
}