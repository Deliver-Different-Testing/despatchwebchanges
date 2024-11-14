using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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
}