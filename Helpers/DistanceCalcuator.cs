using System;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static class DistanceCalculator
{
    private const double EarthRadiusInMiles = 3959.87433;

    public static double CalculateDistance(
        decimal pickupLat,
        decimal pickupLong,
        decimal dropOffLat,
        decimal dropOffLong)
    {
        var latitude1 = ToRadians(pickupLat);
        var longitude1 = ToRadians(pickupLong);
        var latitude2 = ToRadians(dropOffLat);
        var longitude2 = ToRadians(dropOffLong);

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

    private static double ToRadians(decimal degrees) => (double)degrees * Math.PI / 180;
}
