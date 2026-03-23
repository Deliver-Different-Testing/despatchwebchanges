#nullable enable

namespace DespatchWeb.Interfaces;

public interface IConnectionStringManager
{
    Task SetConnectionStringAsync(string tenantAppCacheKey, string connectionString);
    Task<string?> GetConnectionStringAsync(string tenantAppCacheKey);
    string GetConnectionStringFromMemoryCache(string tenantAppCacheKey);
}