using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class RestoreJobsRequest
{
    public List<int> JobIds { get; init; }
}