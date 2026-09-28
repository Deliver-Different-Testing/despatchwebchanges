#nullable disable

namespace DespatchWeb.EntityClasses;

// Hand-written partial extension for TucJobBooking.
// RouteId itself is now part of the auto-generated TucJobBooking.cs (regenerated
// to include the column added by dbmigrationsv2/20260519104500_AddRouteIdToTucJobBookingForRecurringRoutes.sql).
// This partial only holds the navigation property so EF Core Power Tools regen
// doesn't drop the relationship to Route.
public partial class TucJobBooking
{
    public virtual Route Route { get; set; }
}
