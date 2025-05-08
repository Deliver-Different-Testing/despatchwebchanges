using DespatchWeb.Models.FlightStats;
using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class FlightViewModel
{
    public string Airline { get; set; }
    public string FlightNumber { get; set; }
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public string DepartureAirport { get; set; }
    public string ArrivalAirport { get; set; }
    public TimeSpan Duration { get; set; }
    public int Stops { get; set; }
    public string Aircraft { get; set; }
    public List<string> ServiceClasses { get; set; }
    public bool IsCodeShare { get; set; }
    public decimal Amount { get; set; }
    public string CodeShareAirline { get; set; }
    public int AirlineId {get;set;}

    public string DepartureTimeZone { get; set; }
    public string ArrivalTimeZone { get; set; }

    public bool IsMultiSegment { get; set; }
    public int ElapsedTime { get; set; }
    public int Score { get; set; }
    public string ConnectionId { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = new List<FlightSegmentViewModel>();
}

public class FlightSegmentViewModel: ScheduledFlight
{
    public int SegmentOrder { get; set; }
    public int StopsInSegment { get; set; }
    public string DepartureAirportName { get; set; }
    public string DepartureAirportCity { get; set; }
    public string DepartureAirportCountry { get; set; }
    public string DepartureAirportTimeZone { get; set; }
    public string ArrivalAirportName { get; set; }
    public string ArrivalAirportCity { get; set; }
    public string ArrivalAirportCountry { get; set; }
    public string ArrivalAirportTimeZone { get; set; }
    public string AircraftName { get; set; }
    public string AircraftType { get; set; }
    public string AirlineName { get; set; }
}
