namespace DespatchWeb.Constants;

/// <summary>
/// The DespatchWeb dashboard keys in the DF-Admin feature catalogue
/// (<c>dbo.Feature</c>), seeded by dbmigrationsv2 under the
/// <see cref="DespatchWebTile"/> hub tile. These are the surfaces DF Admin can
/// show or hide per client type; each one pairs with a nav item in
/// <c>side-nav/SideNav.tsx</c> and an AngularJS ui-router state in
/// <c>wwwroot/app/routes.ts</c>.
///
/// Keys must match the catalogue exactly — a key with no
/// <c>ClientTypeFeature</c> row is invisible, not broken, so a typo here reads
/// as "DF Admin turned it off".
/// </summary>
public static class DashboardFeatureKeys
{
    /// <summary>Tier-1 tile every DespatchWeb dashboard hangs off.</summary>
    public const string DespatchWebTile = "hub-tile-despatchweb";

    public const string Dispatch = "dw-dispatch";
    public const string Nationwide = "dw-nationwide";
    public const string Overview = "dw-overview";
    public const string TaskDashboard = "dw-task-dashboard";
    public const string JobSearch = "dw-job-search";
    public const string RecurringJobs = "dw-recurring-jobs";
    public const string CourierMap = "dw-courier-map";
    public const string DriverManagement = "dw-driver-management";

    /// <summary>Feature.ReleaseStatus value that lets a feature reach a tenant.</summary>
    public const string LiveReleaseStatus = "Live";
}
