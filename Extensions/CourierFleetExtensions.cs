using DespatchWeb.Enums;

namespace DespatchWeb.Extensions;

public static class CourierFleetExtensions
{
    public static bool IsUrgentArmy(this CourierFleet fleet) =>
        fleet switch
        {
            CourierFleet.UaChristchurch or
                CourierFleet.UaAuckland or
                CourierFleet.UaTauranga or
                CourierFleet.UaWellington or
                CourierFleet.UaAucklandP2P or
                CourierFleet.UaPalmerstonNorth or
                CourierFleet.UaNapierHastings or
                CourierFleet.UaHamilton or
                CourierFleet.UaFulltime or
                CourierFleet.UaGisborne or
                CourierFleet.UaNelson or
                CourierFleet.UaAucklandMonday => true,
            _ => false
        };
}