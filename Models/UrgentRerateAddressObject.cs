namespace DespatchWeb.Models;

public sealed class UrgentRerateAddressObject
{
    public string CompanyName { get; init; }
    public string BuildingName { get; init; }
    public string StreetAddress { get; init; }
    public string City { get; init; }
    public string State { get; init; }
    public string Suburb { get; init; }
    public int? SuburbId { get; init; }
    public string ZipCode { get; init; }
    public string PostCode { get; init; }
    public string CountryCode { get; init; }
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }
}
