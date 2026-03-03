namespace DespatchWeb.Models.Dto;

public class AirportAddressInfoDto
{
    public int AirportId { get; init; }
    public string AddressLine1 { get; init; }
    public string AddressLine2 { get; init; }
    public string AddressLine3 { get; init; }
    public string AddressLine4 { get; init; }
    public string AddressLine5 { get; init; }
    public string AddressLine6 { get; init; }
    public string AddressLine7 { get; init; }
    public string AddressLine8 { get; init; }
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }
}