using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class DfrntViewsRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    IScopeProvider scopeProvider)
    : BaseRepository(contextFactory), IDfrntViewsRepository
{
    public async Task<IReadOnlyList<DfrntPageViewModel>> GetViewsByUserAndPageAsync(int userId, AppPage page)
    {
        Log.Information("Getting views for user {UserId} and page {Page}", userId, page);
        try
        {
            var pageInt = (int)page;

            // Views are an audience list, not a per-user one: NULL is the standard
            // tenant-staff set, and a Network Partner gets only the NP-audience
            // views. Landing an NP on a tenant zone view would scope their Driver
            // Locations panel to that zone's clear lists.
            var audienceClientTypeId = scopeProvider.Scope?.IsNetworkPartner == true
                ? (int?)ClientType.NetworkPartner
                : null;

            var views = await Context.DfrntpageViews
                .Where(pv => pv.PageId == pageInt && pv.View != null
                             && pv.View.ClientTypeId == audienceClientTypeId)
                .Select(dv => new DfrntPageViewModel
                {
                    Id = dv.View.DespatchViewId,
                    Name = dv.View.Name,
                    CenterLatitude = dv.View.CenterLatitude ?? 0m,
                    CenterLongitude = dv.View.CenterLongitude ?? 0m
                })
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
