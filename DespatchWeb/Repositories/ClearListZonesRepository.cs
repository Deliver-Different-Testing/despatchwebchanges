using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClearListZonesRepository : IClearListZonesRepository
{
    private readonly DespatchContext _context;

    public ClearListZonesRepository(DespatchContext context)
    {
        _context = context;
    }

    // Get the views available to populate the top-bar
    public async Task<List<SelectItem>> GetDispatchViewsAsync(int userId)
    {
        var dispatchViews = await _context.UserDespatchViewPreferences
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
        return await _context.TblDespatchViews
            .Where(dv => dv.DespatchViewId == despatchViewId)
            .Select(dv => dv.WhereCondition)
            .FirstOrDefaultAsync();
    }

    public async Task<List<ZoneGroup>> GetZoneGroupsAsync()
    {
        var zoneGroups = await _context.ZoneGroups.ToListAsync();
        return zoneGroups;
    }
}
