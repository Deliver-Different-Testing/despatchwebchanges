namespace DespatchWeb.Models;

public class AddressCoordinates
{
    public AddressCoordinates(decimal latitudePercentage, decimal longitudePercentage)
    {
        LatitudePercentage = latitudePercentage;
        LongitudePercentage = longitudePercentage;
    }

    private decimal LatitudePercentage { get; }
    private decimal LongitudePercentage { get; }

    // Convert percentage to actual coordinates for calculations
    internal double GetActualLatitude() => (double)(LatitudePercentage * 0.9M);
    internal double GetActualLongitude() => (double)(LongitudePercentage * 1.8M);
}