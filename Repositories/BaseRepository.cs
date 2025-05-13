using System;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Repositories;

public class BaseRepository(IDbContextFactory<DespatchContext> contextFactory):IDisposable
{
    private DespatchContext? _context;
    protected DespatchContext Context
    {
        get { return _context ??= contextFactory.CreateDbContext(); }
    }
    public void Dispose()
    {
        _context?.Dispose();
    }
}
