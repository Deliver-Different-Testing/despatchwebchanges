using System.Collections.Generic;

namespace DespatchWeb.Models;

public class JobGroupViewModel
{
    public JobViewModel Job { get; set; }
    public List<JobViewModel> RelatedJobs { get; set; }
}