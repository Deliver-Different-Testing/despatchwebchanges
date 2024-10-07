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

    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        var query =
            from aup in _context.DfrntappUserViewPermissions
            where aup.UserId == userId && aup.IsVisible == true
            join av in _context.TblDespatchViews on aup.ViewId equals av.DespatchViewId
            join pv in _context.DfrntpageViews on av.DespatchViewId equals pv.ViewId
            where pv.PageId == (int)page
            join ap in _context.DfrntappPages on pv.PageId equals ap.PageId
            join app in _context.Dfrntapps on ap.AppId equals app.AppId
            where app.AppName == "DespatchWeb"
            orderby av.Name
            select new SelectItem
            {
                Id = av.DespatchViewId,
                Name = av.Name
            };

        return await query.ToListAsync();
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