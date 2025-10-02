using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class AssignFlightToJobRequest
{
    public int JobId { get; set; }
    public int? FromAirportId { get; set; }
    public int? ToAirportId { get; set; }
    public string FlightNumber { get; set; }
    public DateTimeOffset DepartureDate { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = [];
    public string PackageReadyTime { get; set; }
    public string PackageDeliverByTime { get; set; }
    public string PackageDeliveryNotes { get; set; }
}