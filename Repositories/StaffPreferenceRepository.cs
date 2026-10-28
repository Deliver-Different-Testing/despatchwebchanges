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
        if (await ResolveStaffIdAsync() is not { } staffId)
        {
            return null;
        }

        return await Context.StaffPreferences
            .Where(p => p.StaffId == staffId && p.PreferenceKey == key)
            .Select(p => p.PreferenceJson)
            .FirstOrDefaultAsync();
    }

    public async Task SetPreferenceAsync(string key, string preferenceJson)
    {
        if (await ResolveStaffIdAsync() is not { } staffId)
        {
            return;
        }

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

    public async Task DeletePreferenceAsync(string key)
    {
        if (await ResolveStaffIdAsync() is not { } staffId)
        {
            return;
        }

        var existing = await Context.StaffPreferences
            .AsTracking()
            .FirstOrDefaultAsync(p => p.StaffId == staffId && p.PreferenceKey == key);

        if (existing is null)
        {
            return;
        }

        Context.StaffPreferences.Remove(existing);
        await Context.SaveChangesAsync();
    }

    /// <summary>
    /// Preferences hang off a tucStaff row (FK_StaffPreference_Staff). Tenant / DF Admin client logins can carry no
    /// StaffID claim, or one that is an account-manager link with no staff row, so they have nowhere to store them.
    /// </summary>
    private async Task<int?> ResolveStaffIdAsync() => (await infoService.GetStaffInfoAsync())?.Id;
}
