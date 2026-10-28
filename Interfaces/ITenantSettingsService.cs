#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Reads tenant-wide settings stored as JSON blobs on tblSetting (one row per
/// tenant database). These are written outside despatchweb — e.g. a tenant
/// admin's Dispatch settings page in the Configurator — despatchweb only reads.
/// </summary>
public interface ITenantSettingsService
{
    /// <summary>
    /// Returns the tenant's default address field order for job list display
    /// (JSON, e.g. <c>{"fields":["streetNumber","streetName"]}</c>), or null
    /// when no tenant default is configured.
    /// </summary>
    Task<string?> GetDispatchAddressFormatDefaultAsync();

    /// <summary>
    /// Returns the tenant's default for which place the map courier flags name for a driver's last
    /// delivery (a client-side LastDeliveryLabelMode, e.g. <c>locality</c>), or null when unconfigured.
    /// </summary>
    Task<string?> GetCourierFlagLastDeliveryDefaultAsync();

    /// <summary>
    /// Returns the tenant's default appearance (JSON: contrast level plus optional primary,
    /// secondary and body-text colours), or null when unconfigured. Validated client-side.
    /// </summary>
    Task<string?> GetAppearanceDefaultAsync();
}
