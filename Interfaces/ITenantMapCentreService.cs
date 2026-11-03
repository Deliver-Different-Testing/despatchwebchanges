#nullable enable
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>The tenant's own map centre, so maps open in the tenant's country instead of a hard-coded one.</summary>
public interface ITenantMapCentreService
{
    /// <summary>
    /// The map centre from the tenant's <c>SignUpPageSettings</c> row (the same one Booking's
    /// <c>/MapCenter</c> serves), or <c>null</c> when the table or row does not exist so the front end
    /// falls back to its US/NZ defaults.
    /// </summary>
    Task<MapCentre?> GetMapCentreAsync();
}
