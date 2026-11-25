namespace DespatchWeb.Helpers;

/// <summary>Which agent alert a leg gets. Values match <c>AgentAlertLog.AlertType</c>.</summary>
public enum AgentAlertType : byte
{
    Pickup = 1,
    Delivery = 2,
    DoorToDoor = 3,
}

/// <summary>
/// Picks the alert from what the agent physically does on the leg (Agent alerts spec 4.2, corrected by plan C1):
/// ends at an airport = pickup, starts at one = delivery. <c>isDepartureAirportAgent</c> in
/// <c>AddAgentToJobAsync</c> (from-airport only) is therefore the delivery leg, whatever its status name says.
/// Legs with no airports fall back to the LHP / DEL suffix; anything else is door to door.
/// </summary>
public static class AgentAlertTypes
{
    public static AgentAlertType Resolve(string jobNumber, int? fromAirportId, int? toAirportId) =>
        (fromAirportId, toAirportId) switch
        {
            (null, not null) => AgentAlertType.Pickup,
            (not null, _) => AgentAlertType.Delivery,
            _ => JobLegRoles.FromJobNumber(jobNumber) switch
            {
                JobLegRole.LinehaulPickup => AgentAlertType.Pickup,
                JobLegRole.FinalMileDelivery => AgentAlertType.Delivery,
                _ => AgentAlertType.DoorToDoor,
            },
        };
}
