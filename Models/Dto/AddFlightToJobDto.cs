using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Dto;

public class AddFlightToJobDto
{
    public string CarrierFsCode { get; set; }
    public string FlightNumber { get; set; }
    public DateTimeOffset DepartureTime { get; set; }
    public DateTimeOffset ArrivalTime { get; set; }
    public string AirlineName { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = [];
}
