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
}
