using System;

namespace DespatchWeb.Models.Dto;

public class CourierClearListDto
{
    public int UccrId { get; set; }
    public string Code { get; set; }
    public int? UccrChannelId { get; set; }
    public bool SendJobsViaSms { get; set; }
    public bool AutoDespatch { get; set; }
    public string UccrVehicle { get; set; }
    public int? CourierGpsid { get; set; }
    public DateTime? GpsCreated { get; set; }
    public int? PolygonId { get; set; } 
    public int? DisplayOrder { get; set; }
    public DateTime? OrderTime { get; set; }
    public string Name { get; set; }
    public bool DangerousGoods { get; set; }
    public DateTime? DgLicenseExpiry { get; set; }
    public int JobCount { get; set; }
}

public class CourierJobSuburbDto
{
    public int CourierId { get; set; }
    public int? ToSuburbId { get; set; }
}

public class SuburbClearListAreaDto
{
    public int SuburbId { get; set; }
    public int ClearListAreaId { get; set; }
    public string Code { get; set; }
    public int? ChannelId { get; set; }
}

public class PolygonChannelMapping
{
    public int ClearListAreaId { get; set; }
    public int? PolygonId { get; set; }
    public int? ChannelId { get; set; }
}
