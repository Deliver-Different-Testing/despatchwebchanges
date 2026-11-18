using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class DispatchLayoutRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock tenantClock) : BaseRepository(contextFactory), IDispatchLayoutRepository
{
    public async Task<IReadOnlyList<DispatchLayoutDto>> GetLayoutsAsync(string page)
    {
        if (await ResolveStaffIdAsync() is not { } staffId)
        {
            return [];
        }

        return await Context.StaffDispatchLayouts
            .Where(l => l.StaffId == staffId && l.Page == page)
            .OrderBy(l => l.CreatedUtc)
            .Select(l => new DispatchLayoutDto
            {
                Name = l.Name,
                LayoutJson = l.LayoutJson,
                IsActive = l.IsActive
            })
            .ToListAsync();
    }

    public async Task ReplaceLayoutsAsync(string page, IReadOnlyList<DispatchLayoutDto> layouts)
    {
        if (await ResolveStaffIdAsync() is not { } staffId)
        {
            return;
        }

        var now = tenantClock.UtcNow;

        var existing = await Context.StaffDispatchLayouts
            .AsTracking()
            .Where(l => l.StaffId == staffId && l.Page == page)
            .ToListAsync();

        var incomingNames = layouts.Select(l => l.Name).ToHashSet();

        // Delete layouts the user has removed.
        var toRemove = existing.Where(l => !incomingNames.Contains(l.Name));
        Context.StaffDispatchLayouts.RemoveRange(toRemove);

        foreach (var input in layouts)
        {
            var row = existing.FirstOrDefault(e => e.Name == input.Name);
            if (row is null)
            {
                var layout = new StaffDispatchLayout
                {
                    StaffId = staffId,
                    Page = page,
                    Name = input.Name,
                    LayoutJson = input.LayoutJson,
                    IsActive = input.IsActive,
                    CreatedUtc = now,
                    LastModifiedUtc = now
                };
                await Context.StaffDispatchLayouts.AddAsync(layout);
            }
            else
            {
                row.LayoutJson = input.LayoutJson;
                row.IsActive = input.IsActive;
                row.LastModifiedUtc = now;
            }
        }

        await Context.SaveChangesAsync();
    }

    // Layouts hang off a tucStaff row (FK_StaffDispatchLayout_Staff), which Tenant / DF Admin logins may not have.
    private async Task<int?> ResolveStaffIdAsync() => (await infoService.GetStaffInfoAsync())?.Id;
}