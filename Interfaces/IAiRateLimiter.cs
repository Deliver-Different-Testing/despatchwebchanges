using DespatchWeb.Models;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiRateLimiter
{
    Task<bool> TryAcquireAsync(int userId, string tenantId);
    /// <summary>
    /// Records what one AI call cost. <paramref name="feature"/> is the controller action
    /// name, so spend and cache effectiveness stay attributable per feature and per model.
    /// </summary>
    Task RecordTokenUsageAsync(
        int userId, string tenantId, string feature, AiTaskClass taskClass, AiUsageInfo usage);
}
