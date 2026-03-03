using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AllocateJobsToCourierRequest
{
    public int CourierId { get; init; }
    public List<int> JobIds { get; init; }
}