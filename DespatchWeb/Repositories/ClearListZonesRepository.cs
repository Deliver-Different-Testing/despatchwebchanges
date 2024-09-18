using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClearListZonesRepository : IClearListZonesRepository
{
    private readonly DespatchContext _context;
    private readonly IMapper _mapper;

    public ClearListZonesRepository(DespatchContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    // Get the views available to populate the top-bar
    public async Task<Dictionary<int, string>> GetDispatchViewsAsync(int userId)
    {
        var dispatchViews = await _context.UserDespatchViewPreferences
            .Where(udvp => udvp.UserId == userId)
            .Select(udvp => udvp.DespatchView)
            .ToDictionaryAsync(dv => dv.DespatchViewId, dv => dv.Name);

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
