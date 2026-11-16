#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <inheritdoc cref="ITenantMapCentreService" />
public sealed class TenantMapCentreService(IDbContextFactory<DespatchContext> contextFactory) : ITenantMapCentreService
{
    // SignUpPageSettings' column defaults (Auckland). A row still on them was never given a centre, so an AU
    // tenant would open on Auckland and see no couriers; the front end's country default is the better guess.
    private const decimal DefaultLatitude = -36.850657m;
    private const decimal DefaultLongitude = 174.76466m;

    /// <inheritdoc />
    public async Task<MapCentre?> GetMapCentreAsync()
    {
        await using var context = await contextFactory.CreateDbContextAsync();

        // The table is new and holds no row until someone adds one, so an absent table or row is normal.
        try
        {
            var centre = await context.SignUpPageSettings
                .AsNoTracking()
                .Where(s => s.SignUpPageSettingsId == 1)
                .Select(s => new MapCentre(s.MapCenterLatitude, s.MapCenterLongitude))
                .FirstOrDefaultAsync();
            return centre == new MapCentre(DefaultLatitude, DefaultLongitude) ? null : centre;
        }
        catch (Exception)
        {
            return null;
        }
    }
}
