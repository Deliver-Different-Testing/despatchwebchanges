using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb;

public class DynamicDespatchDbContextFactory(
    IOptions<DbContextOptions<DespatchContext>> options,
    IConnectionStringManager connectionStringManager,
    IHttpContextAccessor contextAccessor)
    : IDbContextFactory<DespatchContext>
{
    private readonly DbContextOptions<DespatchContext> _options = options.Value;

    public DespatchContext CreateDbContext()
    {
        var httpContext = contextAccessor.HttpContext;
        var isAuthenticated = httpContext?.User.Identity?.IsAuthenticated ?? false;
        var tenantId = httpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var cacheKey = $"{tenantId}-ClientManager-Connection";

        // Diagnostic logging for troubleshooting authentication issues
        if (httpContext == null)
        {
            Log.Warning("CreateDbContext called without HttpContext - no authentication context available");
        }
        else if (!isAuthenticated)
        {
            Log.Warning("CreateDbContext called with unauthenticated request. Path: {Path}",
                httpContext.Request.Path);
        }
        else if (string.IsNullOrEmpty(tenantId))
        {
            Log.Warning(
                "CreateDbContext called with authenticated user but missing CurrentTenantID claim. Path: {Path}, User: {User}",
                httpContext.Request.Path,
                httpContext.User.Identity?.Name ?? "unknown");
        }

        // Use sync memory-cache lookup first to avoid blocking the thread pool.
        // Only fall back to the async path (which may hit Redis) when memory cache is cold.
        var connectionString = connectionStringManager.GetConnectionStringFromMemoryCache(cacheKey)
            ?? connectionStringManager.GetConnectionStringAsync(cacheKey).GetAwaiter().GetResult();

        if (string.IsNullOrEmpty(connectionString))
        {
            Log.Error(
                "Connection string is not set. CacheKey: {CacheKey}, IsAuthenticated: {IsAuthenticated}, TenantId: {TenantId}",
                cacheKey, isAuthenticated, tenantId ?? "null");
            throw new InvalidOperationException(
                $"Connection string is not set. TenantId: {tenantId ?? "null"}, IsAuthenticated: {isAuthenticated}");
        }

        var optionsBuilder = new DbContextOptionsBuilder<DespatchContext>(_options);
        optionsBuilder.UseSqlServer(connectionString, sqlOptions =>
        {
            sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            sqlOptions.EnableRetryOnFailure(maxRetryCount: 3);
        });
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);

        return new DespatchContext(optionsBuilder.Options);
    }
}