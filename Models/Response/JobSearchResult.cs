using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class JobSearchResult
{
    public List<DispatchJobViewModel> Jobs { get; set; }
    public int TotalCount { get; set; }
    public bool HasMore { get; set; }
}