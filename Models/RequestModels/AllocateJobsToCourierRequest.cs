using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AllocateJobsToCourierRequest
{
    public int CourierId { get; set; }
    public List<int> JobIds { get; set; }
}