using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class DfrntViewsRepository : IDfrntViewsRepository
{
    private readonly DespatchContext _context;

    public DfrntViewsRepository(DespatchContext context)
    {
        _context = context;
    }

    // Get the views available to populate the top-bar
    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, int pageId)
    {
        var pageViews = await _context.DfrntappUserViewPermissions
            .Where(aup => aup.UserId == userId && aup.IsVisible.Value)
            .Join(_context.DfrntappViews,
                aup => aup.ViewId,
                av => av.ViewId,
                (aup, av) => av)
            .Join(_context.DfrntpageViews,
                av => av.ViewId,
                pv => pv.ViewId,
                (av, pv) => new { av, pv })
            .Where(x => x.pv.PageId == pageId)
            .Select(x => new SelectItem
            {
                Id = x.av.ViewId,
                Name = x.av.Name
            })
            .OrderBy(x => x.Name)
            .ToListAsync();

        return pageViews;
    }

    public async Task<string> GetWhereClauseByDispatchView(int viewId)
    {
        return await _context.DfrntappViews
            .Where(dv => dv.ViewId == viewId)
            .Select(dv => dv.WhereCondition)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ZoneGroup>> GetAllZoneGroupsAsync()
    {
        var zoneGroups = await _context.ZoneGroups.ToListAsync();
        return zoneGroups;
    }
}
