using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class DispatchLayoutRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : BaseRepository(contextFactory), IDispatchLayoutRepository
{
    public async Task<IReadOnlyList<DispatchLayoutDto>> GetLayoutsAsync(string page)
    {
        var staffId = infoService.GetStaffId();

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
        var staffId = infoService.GetStaffId();
        var now = DateTime.UtcNow;

        var existing = await Context.StaffDispatchLayouts
            .AsTracking()
            .Where(l => l.StaffId == staffId && l.Page == page)
            .ToListAsync();

        var incomingNames = layouts.Select(l => l.Name).ToHashSet();

        // Delete layouts the user has removed.
        foreach (var row in existing.Where(e => !incomingNames.Contains(e.Name)))
        {
            Context.StaffDispatchLayouts.Remove(row);
        }

        foreach (var input in layouts)
        {
            var row = existing.FirstOrDefault(e => e.Name == input.Name);
            if (row is null)
            {
                await Context.StaffDispatchLayouts.AddAsync(new StaffDispatchLayout
                {
                    StaffId = staffId,
                    Page = page,
                    Name = input.Name,
                    LayoutJson = input.LayoutJson,
                    IsActive = input.IsActive,
                    CreatedUtc = now,
                    LastModifiedUtc = now
                });
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
}