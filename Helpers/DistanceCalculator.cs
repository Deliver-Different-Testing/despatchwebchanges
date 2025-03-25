using System;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static class DistanceCalculator
{
    private const double EarthRadiusInMiles = 3959.87433;

    /// <summary>
    /// Calculates the distance in miles between two addresses using their percentage-based coordinates
    /// </summary>
    /// <param name="address1">First address coordinates (in percentages)</param>
    /// <param name="address2">Second address coordinates (in percentages)</param>
    /// <returns>Distance in miles between the two addresses</returns>
    public static double CalculateDistance(AddressCoordinates address1, AddressCoordinates address2)
    {
        var latitude1 = ToRadians(address1.GetActualLatitude());
        var longitude1 = ToRadians(address1.GetActualLongitude());
        var latitude2 = ToRadians(address2.GetActualLatitude());
        var longitude2 = ToRadians(address2.GetActualLongitude());

        var distance = CalculateHaversineDistance(
            latitude1,
            longitude1,
            latitude2,
            longitude2,
            EarthRadiusInMiles);

        return Math.Round(distance, 2);
    }

    private static double CalculateHaversineDistance(
        double latitude1,
        double longitude1,
        double latitude2,
        double longitude2,
        double earthRadius)
    {
        var latitudeDifference = latitude2 - latitude1;
        var longitudeDifference = longitude2 - longitude1;

        var haversine = Math.Sin(latitudeDifference / 2) * Math.Sin(latitudeDifference / 2) +
                        Math.Cos(latitude1) * Math.Cos(latitude2) *
                        Math.Sin(longitudeDifference / 2) * Math.Sin(longitudeDifference / 2);

        var centralAngle = 2 * Math.Asin(Math.Sqrt(haversine));

        return earthRadius * centralAngle;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
