namespace DespatchWeb.Models;

public class AddressCoordinates(decimal latitudePercentage, decimal longitudePercentage)
{
    private decimal LatitudePercentage { get; } = latitudePercentage;
    private decimal LongitudePercentage { get; } = longitudePercentage;

    // Convert percentage to actual coordinates for calculations
    internal double GetActualLatitude() => (double)(LatitudePercentage * 0.9M);
    internal double GetActualLongitude() => (double)(LongitudePercentage * 1.8M);
}
