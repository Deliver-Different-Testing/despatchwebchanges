using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AssignFlightToJobRequest
{
    public int JobId { get; set; }
    public int? FromAirportId { get; set; }
    public int? ToAirportId { get; set; }
    public string FlightNumber { get; set; }
    public DateTime DepartureDate { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = [];
    public DateTime? PackageReadyTime { get; set; }
    public DateTime? PackageDeliverByTime { get; set; }
    public string PackageDeliveryNotes { get; set; }
}