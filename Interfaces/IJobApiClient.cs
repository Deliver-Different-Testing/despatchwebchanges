using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IJobApiClient
{
    Task<int> QuickCreateAsync(JobCreateViewModel request, CancellationToken cancellationToken = default);
}
