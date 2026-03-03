using System.Collections.Generic;

namespace DespatchWeb.Models;

public class JobGroupViewModel
{
    public JobViewModel Job { get; init; }
    public List<JobViewModel> RelatedJobs { get; init; }
}