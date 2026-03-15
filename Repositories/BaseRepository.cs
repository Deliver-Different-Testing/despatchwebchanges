using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class BaseRepository(IDbContextFactory<DespatchContext> contextFactory) : IDisposable
{
    private DespatchContext _context;

    protected DespatchContext Context => _context ??= contextFactory.CreateDbContext();

    /// <summary>
    /// Creates a new DbContext instance for parallel operations.
    /// The caller is responsible for disposing the context.
    /// </summary>
    protected DespatchContext CreateNewContext() => contextFactory.CreateDbContext();

    public void Dispose() => _context?.Dispose();

    public async Task AddEntityAsync<T>(T entity)
        where T : class => await Context.Set<T>().AddAsync(entity);  
    
    /// <summary>
    /// Finds an entity by primary key. Uses FindAsync which always returns a tracked entity
    /// (bypasses the global NoTracking default). Use this when you intend to modify and save the entity.
    /// For read-only lookups, prefer a direct query with .Select() projection instead.
    /// </summary>
    public async Task<T> GetByIdAsync<T>(int id) where T : class => await Context.Set<T>().FindAsync(id);

    public async Task SaveChangesAsync() => await Context.SaveChangesAsync();
}
