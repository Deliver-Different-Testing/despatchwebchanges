using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class UserPreferenceRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : BaseRepository(contextFactory), IUserPreferenceRepository
{
    public async Task<string> GetAsync(string preferenceKey)
    {
        var staffId = infoService.GetStaffId();

        return await Context.StaffPreferences
            .Where(p => p.StaffId == staffId && p.PreferenceKey == preferenceKey)
            .Select(p => p.PreferenceJson)
            .FirstOrDefaultAsync();
    }

    public async Task SaveAsync(string preferenceKey, string preferenceJson)
    {
        var staffId = infoService.GetStaffId();
        var now = DateTime.UtcNow;

        // AsTracking because NoTracking is the runtime default here, and this is a
        // read-then-mutate: without it the update below is silently discarded.
        var existing = await Context.StaffPreferences
            .AsTracking()
            .FirstOrDefaultAsync(p => p.StaffId == staffId && p.PreferenceKey == preferenceKey);

        if (existing is null)
        {
            await Context.StaffPreferences.AddAsync(new StaffPreference
            {
                StaffId = staffId,
                PreferenceKey = preferenceKey,
                PreferenceJson = preferenceJson,
                CreatedUtc = now,
                LastModifiedUtc = now
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
