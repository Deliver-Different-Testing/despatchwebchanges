#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed class TenantSettingsService(IDbContextFactory<DespatchContext> contextFactory)
    : ITenantSettingsService
{
    public async Task<string?> GetDispatchAddressFormatDefaultAsync()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        return await ctx.TblSettings
            .Select(s => s.DispatchAddressFormatJson)
            .FirstOrDefaultAsync();
    }

    public async Task<string?> GetCourierFlagLastDeliveryDefaultAsync()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        return await ctx.TblSettings
            .Select(s => s.CourierFlagLastDeliveryMode)
            .FirstOrDefaultAsync();
    }

    public async Task<string?> GetAppearanceDefaultAsync()
    {
        await using var ctx = await contextFactory.CreateDbContextAsync();

        return await ctx.TblSettings
            .Select(s => s.AppearanceDefaultsJson)
            .FirstOrDefaultAsync();
    }
}
