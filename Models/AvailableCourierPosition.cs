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
}
