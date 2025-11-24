using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AvailableCourierPosition
{
    public int CourierId { get; set; }
    public string CourierName { get; set; }
    public int ChannelId { get; set; }
    public string VehicleType { get; set; }
    public string Code { get; set; }
    public bool IsUrgentArmyDriver { get; set; }
    public List<int> ClearListAreaIDs { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? Latitude { get; set; }
    public int TotalJobs { get; set; }
    public int OverDueJobs { get; set; }
    public int? DisplayOrder { get; set; }
}
