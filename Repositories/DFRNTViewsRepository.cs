using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class DfrntViewsRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), IDfrntViewsRepository
{
    
    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        return await Context.TblDespatchViews.Select(dv => new SelectItem
        {
            Id = dv.DespatchViewId,
            Name = dv.Name
        }).ToListAsync();


        /*var query =
            from aup in _context.DfrntappUserViewPermissions
            where aup.UserId == userId && aup.IsVisible == true
            join av in Context.TblDespatchViews on aup.ViewId equals av.DespatchViewId
            join pv in Context.DfrntpageViews on av.DespatchViewId equals pv.ViewId
            where pv.PageId == (int)page
            join ap in Context.DfrntappPages on pv.PageId equals ap.PageId
            join app in Context.Dfrntapps on ap.AppId equals app.AppId
            where app.AppName == "DespatchWeb"
            orderby av.Name
            select new SelectItem
            {
                Id = av.DespatchViewId,
                Name = av.Name
            };

        return await query.ToListAsync();*/
    }

    public async Task<string> GetWhereClauseByDispatchView(int viewId)
    {
        return await Context.TblDespatchViews
            .Where(dv => dv.DespatchViewId == viewId)
            .Select(dv => dv.WhereCondition)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ZoneGroup>> GetAllZoneGroupsAsync()
    {
        var zoneGroups = await Context.ZoneGroups.ToListAsync();
        return zoneGroups;
    }
}
