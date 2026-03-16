namespace DespatchWeb.Models;

public sealed class JobGroupViewModel
{
    public JobViewModel Job { get; init; }
    public List<JobViewModel> RelatedJobs { get; init; }
}