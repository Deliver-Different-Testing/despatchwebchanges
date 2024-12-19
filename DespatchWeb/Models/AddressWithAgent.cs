using Microsoft.Build.Framework;

namespace DespatchWeb.Models;

public class AddressWithAgent
{
    /// <summary>
    /// Airport identifier
    /// </summary>
    public int AirportId { get; set; }

    /// <summary>
    /// 3 letter airport code to identify this airport
    /// </summary>
    public string? AirportCode { get; set; }

    /// <summary>
    /// Property identifier
    /// E.g. Urgent Couriers
    /// </summary>
    public string CompanyName { get; set; }

    /// <summary>
    /// Property identifier
    /// E.g. Unit 1, Level 10, Panasonic House
    /// </summary>
    public string BuildingName { get; set; }

    /// <summary>
    /// Street number and name
    /// </summary>
    [Required]
    public string StreetAddress { get; set; }

    /// <summary>
    /// City name
    /// </summary>
    [Required]
    public string City { get; set; }

    /// <summary>
    /// State name.
    /// </summary>
    [Required]
    public string State { get; set; }

    /// <summary>
    /// String:10, zip code
    /// </summary>
    public string ZipCode { get; set; }

    /// <summary>
    /// ISO Alpha 2 country code.
    /// E.g. NZ, AU, US, GB, CN, CA
    /// </summary>
    public string CountryCode { get; set; } = "US";

    /// <summary>
    /// Please pass this if you can, it helps with address accuracy
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    ///  Please pass this if you can, it helps with address accuracy
    /// </summary>
    public decimal? Longitude { get; set; }

    /// <summary>
    ///  Distance from address to airport as the crow flies
    /// </summary>
    public decimal? Distance { get; set; }

    /// <summary>
    ///  Distance from address to airport via roads
    /// </summary>
    public decimal? RoadDistance { get; set; }

    /// <summary>
    /// Agent who services this airport
    /// </summary>
    public int AgentId { get; set; }

    /// <summary>
    /// Name of Agent who services this airport
    /// </summary>
    public string AgentName { get; set; }

    /// <summary>
    /// Max Kms of Agent before using km rate from depot to pickup/dest
    /// </summary>
    public int? MaxKms { get; set; }
}