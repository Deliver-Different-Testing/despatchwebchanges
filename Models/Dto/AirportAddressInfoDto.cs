namespace DespatchWeb.Models.Dto;

public class AirportAddressInfoDto
{
    public int AirportId { get; set; }
    public string AddressLine1 { get; set; }
    public string AddressLine2 { get; set; }
    public string AddressLine3 { get; set; }
    public string AddressLine4 { get; set; }
    public string AddressLine5 { get; set; }
    public string AddressLine6 { get; set; }
    public string AddressLine7 { get; set; }
    public string AddressLine8 { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}