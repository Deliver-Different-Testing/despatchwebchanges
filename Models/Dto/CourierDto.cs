using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Dto;

public class CourierDto
{
    public int CourierId { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
    public int ChannelId { get; set; }
    public string VehicleType { get; set; }
    public List<int> ClearListAreaIDs { get; set; }
    public string Code { get; set; }
    public int? FleetId { get; set; }
    public int TotalJobs { get; set; }
    public List<JobDto> Jobs { get; set; }
    public string CourierName { get; set; }
}

public class JobDto
{
    public DateTime UcjbDate { get; set; }
    public DateTime? UcjbTime { get; set; }
    public int? Minutes { get; set; }
}
