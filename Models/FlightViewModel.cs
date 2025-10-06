using DespatchWeb.Models.FlightStats;
using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class FlightViewModel
{
    public string Airline { get; set; }
    public string AirlineCode { get; set; }
    public string FlightNumber { get; set; }
    public DateTimeOffset DepartureTime { get; set; }
    public DateTimeOffset ArrivalTime { get; set; }
    public string DepartureAirport { get; set; }
    public string ArrivalAirport { get; set; }
    public TimeSpan Duration { get; set; }
    public int Stops { get; set; }
    public string Aircraft { get; set; }
    public List<string> ServiceClasses { get; set; }
    public bool IsCodeShare { get; set; }
    public decimal Amount { get; set; }
    public string CodeShareAirline { get; set; }
    public bool IsMultiSegment { get; set; }
    public int ElapsedTime { get; set; }
    public int Score { get; set; }
    public string ConnectionId { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = [];
    public string DepartureTimeZone { get; set; }
    public string ArrivalTimeZone { get; set; }
}

public class FlightSegmentViewModel: ScheduledFlight
{
    public DateTimeOffset DepartureTime { get; set; }
    public DateTimeOffset ArrivalTime { get; set; }
    public int SegmentOrder { get; set; }
    public int StopsInSegment { get; set; }
    public int DepartureAirportId { get; set; }
    public string DepartureAirportName { get; set; }
    public string DepartureAirportCity { get; set; }
    public string DepartureAirportCountry { get; set; }
    public string DepartureAirportTimeZone { get; set; }
    public int DepartureAirportTimeZoneId { get; set; }
    public int ArrivalAirportId { get; set; }
    public string ArrivalAirportName { get; set; }
    public string ArrivalAirportCity { get; set; }
    public string ArrivalAirportCountry { get; set; }
    public string ArrivalAirportTimeZone { get; set; }
    public int ArrivalAirportTimeZoneId { get; set; }
    public string AircraftName { get; set; }
    public string AircraftType { get; set; }
    public string AirlineName { get; set; }
    public string CarrierFsCode { get; set; }
    public string FlightNumber { get; set; }
    public string DepartureAirportFsCode { get; set; }
    public string ArrivalAirportFsCode { get; set; }
    public int? Stops { get; set; }
    public string FlightEquipmentIataCode { get; set; }
    public bool? IsCodeshare { get; set; }
    public bool? IsWetlease { get; set; }
    public string ServiceType { get; set; }
    public List<string> ServiceClasses { get; set; }
    public List<object> TrafficRestrictions { get; set; }
    public int? ElapsedTime { get; set; }
    public string ArrivalTerminal { get; set; }
    public string DepartureTerminal { get; set; }
    public List<Codeshare> Codeshares { get; set; }
}