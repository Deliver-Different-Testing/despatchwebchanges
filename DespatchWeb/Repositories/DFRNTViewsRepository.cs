using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
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
    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        return await _context.DfrntappUserViewPermissions
            .Where(aup => aup.UserId == userId && aup.IsVisible == true)
            .Join(_context.TblDespatchViews,
                aup => aup.ViewId,
                av => av.DespatchViewId,
                (aup, av) => av)
            .Join(_context.DfrntpageViews.Where(pv => pv.PageId == (int)page),
                av => av.DespatchViewId,
                pv => pv.ViewId,
                (av, pv) => new { av, pv })
            .Join(_context.DfrntappPages,
                x => x.pv.PageId,
                ap => ap.PageId,
                (x, ap) => new { x.av, ap })
            .Join(_context.Dfrntapps.Where(app => app.AppName == "DespatchWeb"),
                x => x.ap.AppId,
                app => app.AppId,
                (x, app) => x.av)
            .Select(av => new SelectItem
            {
                Id = av.DespatchViewId,
                Name = av.Name
            })
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<string> GetWhereClauseByDispatchView(int viewId)
    {
        return await _context.TblDespatchViews
            .Where(dv => dv.DespatchViewId == viewId)
            .Select(dv => dv.WhereCondition)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ZoneGroup>> GetAllZoneGroupsAsync()
    {
        var zoneGroups = await _context.ZoneGroups.ToListAsync();
        return zoneGroups;
    }
}