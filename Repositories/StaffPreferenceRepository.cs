#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class StaffPreferenceRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    ITenantClock tenantClock) : BaseRepository(contextFactory), IStaffPreferenceRepository
{
    public async Task<string?> GetPreferenceAsync(string key)
    {
        var staffId = infoService.GetStaffId();

        return await Context.StaffPreferences
            .Where(p => p.StaffId == staffId && p.PreferenceKey == key)
            .Select(p => p.PreferenceJson)
            .FirstOrDefaultAsync();
    }

    public async Task SetPreferenceAsync(string key, string preferenceJson)
    {
        var staffId = infoService.GetStaffId();
        var now = tenantClock.UtcNow;

        var existing = await Context.StaffPreferences
            .AsTracking()
            .FirstOrDefaultAsync(p => p.StaffId == staffId && p.PreferenceKey == key);

        if (existing is null)
        {
            await Context.StaffPreferences.AddAsync(new StaffPreference
            {
                StaffId = staffId,
                PreferenceKey = key,
                PreferenceJson = preferenceJson,
                CreatedUtc = now,
                LastModifiedUtc = now,
            });
        }
        else
        {
            existing.PreferenceJson = preferenceJson;
            existing.LastModifiedUtc = now;
        }

        await Context.SaveChangesAsync();
    }
}
