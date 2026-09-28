#nullable enable annotations
namespace DespatchWeb.Models;

public class AvailableCourierPosition
{
    public int CourierId { get; init; }
    public string CourierName { get; init; }
    public int ChannelId { get; init; }
    public string VehicleType { get; init; }
    public string Code { get; init; }
    public bool IsUrgentArmyDriver { get; init; }
    public List<int> ClearListAreaIDs { get; init; }
    public decimal? Longitude { get; init; }
    public decimal? Latitude { get; init; }
    public int TotalJobs { get; init; }
    public int OverDueJobs { get; init; }
    public int? DisplayOrder { get; init; }
    public int? CourierFleetId { get; init; }
    public string? CourierFleetName { get; init; }

    /// <summary>City (or suburb, where the city is blank) of the courier's most recently completed job.</summary>
    public string? LastDeliveryCity { get; init; }

    /// <summary>
    /// When that delivery was completed, in tenant time. The map flags show the elapsed minutes and
    /// must keep counting between polls, so the instant travels rather than a precomputed age.
    /// </summary>
    public DateTimeOffset? LastDeliveryTime { get; init; }
}
