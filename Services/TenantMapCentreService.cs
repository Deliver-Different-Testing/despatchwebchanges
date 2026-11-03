#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <inheritdoc cref="ITenantMapCentreService" />
public sealed class TenantMapCentreService(IDbContextFactory<DespatchContext> contextFactory) : ITenantMapCentreService
{
    /// <inheritdoc />
    public async Task<MapCentre?> GetMapCentreAsync()
    {
        await using var context = await contextFactory.CreateDbContextAsync();

        // The table is new and holds no row until someone adds one, so an absent table or row is normal.
        try
        {
            var rows = await context.SqlQueryAsync<MapCentreRow>(
                "SELECT MapCenterLatitude AS Lat, MapCenterLongitude AS Lng FROM SignUpPageSettings WHERE SignUpPageSettingsId = 1");
            return rows.FirstOrDefault() is { } row ? new MapCentre(row.Lat, row.Lng) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private sealed class MapCentreRow
    {
        public decimal Lat { get; set; }
        public decimal Lng { get; set; }
    }
}
