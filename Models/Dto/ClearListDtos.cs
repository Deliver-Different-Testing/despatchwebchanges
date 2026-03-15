namespace DespatchWeb.Models.Dto;

public class CourierClearListDto
{
    public int UccrId { get; init; }
    public string Code { get; init; }
    public int? UccrChannelId { get; init; }
    public bool SendJobsViaSms { get; init; }
    public bool AutoDespatch { get; init; }
    public string UccrVehicle { get; init; }
    public int? CourierGpsid { get; init; }
    public DateTime? GpsCreated { get; init; }
    public int? PolygonId { get; init; }
    public int? ZipPolygonId { get; init; }
    public int? DisplayOrder { get; set; }
    public DateTime? OrderTime { get; set; }
    public string Name { get; init; }
    public bool DangerousGoods { get; init; }
    public DateTime? DgLicenseExpiry { get; init; }
    public int JobCount { get; set; }
}

public class CourierJobSuburbDto
{
    public int CourierId { get; init; }
    public int? ToSuburbId { get; init; }
    public decimal? DeliveryLatitude { get; init; }
    public decimal? DeliveryLongitude { get; init; }
}

public class SuburbClearListAreaDto
{
    public int SuburbId { get; init; }
    public int ClearListAreaId { get; init; }
    public string Code { get; init; }
    public int? ChannelId { get; init; }
}

public class PolygonChannelMapping
{
    public int ClearListAreaId { get; init; }
    public int? PolygonId { get; init; }
    public int? ZipPolygonId { get; init; }
    public int? ChannelId { get; init; }
}
