using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Serilog;

namespace DespatchWeb.Repositories;

public class DfrntViewsRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), IDfrntViewsRepository
{
    
    public async Task<List<SelectItem>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        Log.Information("Getting views for user {UserId} and page {Page}", userId, page);
        try
        {
            var views = await Context.DfrntpageViews
                .Where(pv => pv.PageId == (int)page)
                .Select(dv => new SelectItem
                {
                    Id = dv.View.DespatchViewId,
                    Name = dv.View.Name
                })
                .AsNoTracking()
                .ToListAsync();

            Log.Information("Retrieved {Count} views for user {UserId} and page {Page}",
                views.Count, userId, page);
            return views;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving views for user {UserId} and page {Page}",
                userId, page);
            throw;
        }
    }

    public async Task<string> GetWhereClauseByDispatchView(int viewId)
    {
        Log.Information("Getting where clause for dispatch view {ViewId}", viewId);
        try
        {
            var whereClause = await Context.TblDespatchViews
                .Where(dv => dv.DespatchViewId == viewId)
                .Select(dv => dv.WhereCondition)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (whereClause == null)
            {
                Log.Warning("No where clause found for dispatch view {ViewId}", viewId);
            }
            else
            {
                Log.Debug("Retrieved where clause for dispatch view {ViewId}", viewId);
            }

            return whereClause;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving where clause for dispatch view {ViewId}",
                viewId);
            throw;
        }
    }

    public async Task<List<ZoneGroup>> GetAllZoneGroupsAsync()
    {
        Log.Information("Getting all zone groups");
        try
        {
            var zoneGroups = await Context.ZoneGroups.AsNoTracking().ToListAsync();
            Log.Information("Retrieved {Count} zone groups", zoneGroups.Count);
            return zoneGroups;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving all zone groups");
            throw;
        }
    }

    public async Task<List<PageLayoutViewModel>> GetSavedLayoutsForUserAsync(AppPage page, int staffId)
    {
        try
        {
            return await _context.TucStaffs
                .Where(s => s.UcstId == staffId)
                .SelectMany(s => s.DfrntuserPageLayouts)
                .Where(l => l.PageId == (int)page)
                .Select(l => new PageLayoutViewModel
                {
                    LayoutName = l.LayoutName,
                    Json = l.Layout
                })
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, $"Error retrieving layouts for staffId {staffId}");
            throw;
        }
    }

    public async Task SaveUserLayoutAsync(PageLayoutRequest viewModel)
    {
        try
        {
            var layout = new DfrntuserPageLayout
            {
                LayoutName = viewModel.LayoutName,
                PageId = viewModel.PageId,
                UserId = viewModel.StaffId,
                CreatedDate = DateTime.Now
            };

            await _context.DfrntuserPageLayouts.AddAsync(layout);
        }
        catch (Exception e)
        {
            Log.Error(e, $"Error saving layout for staffId {viewModel.StaffId}");
            throw;
        }
    }
}
