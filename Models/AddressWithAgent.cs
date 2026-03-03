using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class AddressWithAgent
{
    /// <summary>
    /// Airport identifier
    /// </summary>
    public int AirportId { get; init; }

    /// <summary>
    /// 3 letter airport code to identify this airport
    /// </summary>
    public string AirportCode { get; init; }

    /// <summary>
    /// Property identifier
    /// E.g. Urgent Couriers
    /// </summary>
    public string CompanyName { get; init; }

    /// <summary>
    /// Property identifier
    /// E.g. Unit 1, Level 10, Panasonic House
    /// </summary>
    public string BuildingName { get; init; }

    /// <summary>
    /// Street number and name
    /// </summary>
    [Required]
    public string StreetAddress { get; init; }

    /// <summary>
    /// City name
    /// </summary>
    [Required]
    public string City { get; init; }

    /// <summary>
    /// State name.
    /// </summary>
    [Required]
    public string State { get; init; }

    /// <summary>
    /// String:10, zip code
    /// </summary>
    public string ZipCode { get; init; }

    /// <summary>
    /// ISO Alpha 2 country code.
    /// E.g. NZ, AU, US, GB, CN, CA
    /// </summary>
    public string CountryCode { get; init; } = "US";

    /// <summary>
    /// Please pass this if you can, it helps with address accuracy
    /// </summary>
    public decimal? Latitude { get; init; }

    /// <summary>
    ///  Please pass this if you can, it helps with address accuracy
    /// </summary>
    public decimal? Longitude { get; init; }

    /// <summary>
    ///  Distance from address to airport as the crow flies
    /// </summary>
    public decimal? Distance { get; init; }

    /// <summary>
    ///  Distance from address to airport via roads
    /// </summary>
    public decimal? RoadDistance { get; init; }

    /// <summary>
    /// Agent who services this airport
    /// </summary>
    public int AgentId { get; init; }

    /// <summary>
    /// Name of Agent who services this airport
    /// </summary>
    public string AgentName { get; init; }

    /// <summary>
    /// Max Kms of Agent before using km rate from depot to pickup/dest
    /// </summary>
    public int? MaxKms { get; init; }
}