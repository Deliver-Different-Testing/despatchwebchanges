using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Dto;

public class AddFlightToJobDto
{
    public string CarrierFsCode { get; set; }
    public string FlightNumber { get; set; }
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public string AirlineName { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = [];
}
