using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public sealed class AddressWithAgent
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
    /// Agent who services this airport
    /// </summary>
    public int AgentId { get; init; }
}