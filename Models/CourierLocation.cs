namespace DespatchWeb.Models;

public sealed class CourierLocation
{
    public decimal Longitude { get; init; }

    public decimal Latitude { get; init; }

    public string Time { get; init; }

    public string Status { get; init; }

    public int JobId { get; init; }

    public bool GpsWasEstimated { get; init; }

    public string RawData { get; init; }

    public string CourierName { get; init; }

    public string FirstName { get; init; }
}