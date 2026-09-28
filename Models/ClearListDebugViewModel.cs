namespace DespatchWeb.Models;

public sealed class ClearListDebugViewModel
{
    public int CourierId { get; set; }
    public string CourierCode { get; set; }
    public string CourierName { get; set; }
    public int? ChannelId { get; set; }
    public string FleetName { get; set; }

    // GPS Info
    public int? GpsPolygonId { get; set; }
    public string GpsPolygonName { get; set; }
    public List<string> GpsPolygonSuburbs { get; set; } = [];
    public decimal? GpsLatitude { get; set; }
    public decimal? GpsLongitude { get; set; }
    public DateTime? GpsTimestamp { get; set; }
    public double? GpsAgeMinutes { get; set; }

    // Clear List Area Order (admin assignment)
    public int? AssignedClearListAreaId { get; set; }
    public string AssignedClearListAreaName { get; set; }
    public int? AssignedStatus { get; set; }
    public string AssignedStatusLabel { get; set; }

    // Which areas this courier's polygon maps to
    public List<PolygonAreaMapping> PolygonAreaMappings { get; set; } = [];

    // Login status
    public bool IsLoggedIn { get; set; }
    public DateTime? LoginTime { get; set; }

    // Explanation
    public string Explanation { get; set; }
}

public sealed class PolygonAreaMapping
{
    public int ClearListAreaId { get; set; }
    public string ClearListAreaName { get; set; }
    public int? AreaChannelId { get; set; }
    public bool ChannelMatches { get; set; }
}
