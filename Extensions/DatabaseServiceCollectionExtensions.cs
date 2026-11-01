using DespatchWeb.EntityClasses;
using DespatchWeb.Interceptors;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Extensions;

public static class DatabaseServiceCollectionExtensions
{
    /// <summary>
    /// Registers the multi-tenant database context factory.
    /// First registers EF Core infrastructure with a placeholder connection string,
    /// then overrides the factory with DynamicDespatchDbContextFactory which resolves
    /// tenant-specific connection strings at runtime from the authenticated user's claims.
    /// </summary>
    public static void AddMultiTenantDatabase(this IServiceCollection services)
    {
        // Phase 1: Register EF Core infrastructure (options, model caching, etc.)
        // The connection string here is a placeholder — it's never used at runtime.
        services.AddDbContextFactory<DespatchContext>(options =>
                options.UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=dummy;Trusted_Connection=True;"),
            ServiceLifetime.Transient);

        // Registered as a singleton so the same instance is handed to
        // AddInterceptors on every CreateDbContext call — a fresh instance per
        // call would change the options hash and spawn a new EF internal service
        // provider each time.
        services.AddSingleton<StaffSessionContextInterceptor>();

        // Phase 2: Override the factory with our tenant-aware implementation
        // that resolves the real connection string per-request from cached tenant config.
        services.AddScoped<IDbContextFactory<DespatchContext>, DynamicDespatchDbContextFactory>();

        // Readiness (/healthz) waits on this, so fresh pods take no traffic until the model is built.
        services.AddSingleton<EfModelWarmupState>();
        services.AddHostedService(sp => new EfModelWarmupService(
            sp.GetRequiredService<IOptions<DbContextOptions<DespatchContext>>>(),
            sp.GetRequiredService<StaffSessionContextInterceptor>(),
            sp.GetRequiredService<EfModelWarmupState>()));
    }
}