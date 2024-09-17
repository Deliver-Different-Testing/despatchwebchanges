using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClearListZonesRepository
{
    private readonly DespatchContext _context;
    private readonly IMapper _mapper;

    public ClearListZonesRepository(DespatchContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    // Get the views available to populate the topar
    public async Task<Dictionary<int, string>> GetDispatchViewsAsync(List<int> dispatchViewIds)
    {
        var dispatchViews = await _context.TblDespatchViews
            .Select(x => new { x.DespatchViewId, x.Name })
            .ToDictionaryAsync(x => x.DespatchViewId, x => x.Name);

        return dispatchViews;
    }

    public async Task GetZoneGroups(int dispatchViewId)
    {
