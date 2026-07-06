using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IAiRateLimiter
{
    Task<bool> TryAcquireAsync(int staffId, string tenantId);
    Task RecordTokenUsageAsync(int staffId, string tenantId, AiUsageInfo usage);
}
