using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClearListZonesRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), IClearListZonesRepository
{
    // Get the views available to populate the top-bar
    public async Task<List<SelectItem>> GetDispatchViewsAsync(int userId)
    {
        var dispatchViews = await Context.UserDespatchViewPreferences
            .Where(udvp => udvp.UserId == userId)
            .Select(udvp => udvp.DespatchView)
            .Select(dv => new SelectItem
            {
                Id = dv.DespatchViewId,
                Name = dv.Name
            })
            .ToListAsync();

        return dispatchViews;
    }

    public async Task<string> GetWhereClauseByDispatchView(int despatchViewId)
    {
        return await Context.TblDespatchViews
            .Where(dv => dv.DespatchViewId == despatchViewId)
            .Select(dv => dv.WhereCondition)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ZoneGroup>> GetZoneGroupsAsync()
    {
        var zoneGroups = await Context.ZoneGroups.ToListAsync();
        return zoneGroups;
    }
}
