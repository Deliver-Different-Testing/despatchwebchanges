using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

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

        // Phase 2: Override the factory with our tenant-aware implementation
        // that resolves the real connection string per-request from cached tenant config.
        services.AddScoped<IDbContextFactory<DespatchContext>, DynamicDespatchDbContextFactory>();
    }
}