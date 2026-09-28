using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interceptors;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb;

public class DynamicDespatchDbContextFactory(
    IOptions<DbContextOptions<DespatchContext>> options,
    IConnectionStringManager connectionStringManager,
    IHttpContextAccessor contextAccessor,
    IServiceProvider serviceProvider,
    StaffSessionContextInterceptor staffSessionContextInterceptor)
    : IDbContextFactory<DespatchContext>
{
    private readonly DbContextOptions<DespatchContext> _options = options.Value;

    public DespatchContext CreateDbContext()
    {
        var httpContext = contextAccessor.HttpContext;
        var isAuthenticated = httpContext?.User.Identity?.IsAuthenticated ?? false;
        var tenantId = httpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var cacheKey = TenantConnectionCache.Key(tenantId);

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
            // Transitional: sessions seeded under the old shared key before this app
            // owned its own. ApplyOwnCredentials below makes reading it safe.
            var legacyKey = TenantConnectionCache.LegacyKey(tenantId);
            connectionString = connectionStringManager.GetConnectionStringFromMemoryCache(legacyKey)
                ?? connectionStringManager.GetConnectionStringAsync(legacyKey).GetAwaiter().GetResult();
        }

        if (string.IsNullOrEmpty(connectionString))
        {
            Log.Error(
                "Connection string is not set. CacheKey: {CacheKey}, IsAuthenticated: {IsAuthenticated}, TenantId: {TenantId}",
                cacheKey, isAuthenticated, tenantId ?? "null");
            throw new InvalidOperationException(
                $"Connection string is not set. TenantId: {tenantId ?? "null"}, IsAuthenticated: {isAuthenticated}");
        }

        // Always connect as ourselves, whichever app last wrote the entry we read.
        connectionString = TenantConnectionCache.ApplyOwnCredentials(connectionString);

        var optionsBuilder = new DbContextOptionsBuilder<DespatchContext>(_options);
        optionsBuilder.UseSqlServer(connectionString, sqlOptions =>
        {
            sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            sqlOptions.EnableRetryOnFailure(maxRetryCount: 3);
        });
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);

        // Stamps the acting staff id into SQL session context on each connection
        // open so the JobDeliveryJourney triggers can attribute the change.
        optionsBuilder.AddInterceptors(staffSessionContextInterceptor);


        var scope = serviceProvider.GetRequiredService<IScopeProvider>();
        return new DespatchContext(optionsBuilder.Options, scope);
    }
}