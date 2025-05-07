using System;
using System.Linq;
using System.Threading.Tasks;
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

    protected async Task<TimeZoneInfo> GetTimeZoneInfoByIdAsync(int timeZoneId)
    {
        var timeZone = await Context.TimeZones.Select(tz => tz.Name).FirstOrDefaultAsync();
        var timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        return timeZoneInfo;
    }
}
