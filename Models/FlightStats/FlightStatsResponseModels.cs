using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;

public class FlightConnectionsResponse
{
    [JsonPropertyName("request")] public Request Request { get; set; }

    [JsonPropertyName("connections")] public List<Connection> Connections { get; set; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; set; }
}

public class Airline
{
    [JsonPropertyName("fs")] public string Fs { get; set; }

    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("icao")] public string Icao { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("active")] public bool Active { get; set; }
}

public class Airport
{
    [JsonPropertyName("fs")] public string Fs { get; set; }

    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("icao")] public string Icao { get; set; }

    [JsonPropertyName("faa")] public string Faa { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("street1")] public string Street1 { get; set; }

    [JsonPropertyName("city")] public string City { get; set; }

    [JsonPropertyName("cityCode")] public string CityCode { get; set; }

    [JsonPropertyName("stateCode")] public string StateCode { get; set; }

    [JsonPropertyName("postalCode")] public string PostalCode { get; set; }

    [JsonPropertyName("countryCode")] public string CountryCode { get; set; }

    [JsonPropertyName("countryName")] public string CountryName { get; set; }

    [JsonPropertyName("regionName")] public string RegionName { get; set; }

    [JsonPropertyName("timeZoneRegionName")] public string TimeZoneRegionName { get; set; }

    [JsonPropertyName("weatherZone")] public string WeatherZone { get; set; }

    [JsonPropertyName("localTime")] public DateTime LocalTime { get; set; }

    [JsonPropertyName("utcOffsetHours")] public double UtcOffsetHours { get; set; }

    [JsonPropertyName("latitude")] public double Latitude { get; set; }

    [JsonPropertyName("longitude")] public double Longitude { get; set; }

    [JsonPropertyName("elevationFeet")] public int ElevationFeet { get; set; }

    [JsonPropertyName("classification")] public int Classification { get; set; }

    [JsonPropertyName("active")] public bool Active { get; set; }

    [JsonPropertyName("street2")] public string Street2 { get; set; }
}

public class AllowNearbyArrivals
{
    [JsonPropertyName("interpreted")] public bool Interpreted { get; set; }
}

public class AllowNearbyDepartures
{
    [JsonPropertyName("interpreted")] public bool Interpreted { get; set; }
}

public class ExcludeAirlines
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class ExcludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class IncludeAirlines
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class IncludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class IncludeCodeshares
{
    [JsonPropertyName("interpreted")] public bool Interpreted { get; set; }
}

public class IncludeMultipleCarriers
{
    [JsonPropertyName("interpreted")] public bool Interpreted { get; set; }
}

public class IncludeSurface
{
    [JsonPropertyName("interpreted")] public bool Interpreted { get; set; }
}

public class MaxConnections
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public int Interpreted { get; set; }
}

public class MaxResults
{
    [JsonPropertyName("interpreted")] public int Interpreted { get; set; }
}

public class NumHours
{
    [JsonPropertyName("interpreted")] public int Interpreted { get; set; }
}

public class PayloadType
{
    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Appendix
{
    [JsonPropertyName("airlines")] public List<Airline> Airlines { get; set; }

    [JsonPropertyName("airports")] public List<Airport> Airports { get; set; }

    [JsonPropertyName("equipments")] public List<Equipment> Equipments { get; set; }
}

public class ArrivalAirport
{
    [JsonPropertyName("requestedCode")] public string RequestedCode { get; set; }

    [JsonPropertyName("fsCode")] public string FsCode { get; set; }
}

public class CodeShare
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("trafficRestrictions")] public List<string> TrafficRestrictions { get; set; }

    [JsonPropertyName("referenceCode")] public int ReferenceCode { get; set; }
}

public class Date
{
    [JsonPropertyName("year")] public string Year { get; set; }

    [JsonPropertyName("month")] public string Month { get; set; }

    [JsonPropertyName("day")] public string Day { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class DepartureAirport
{
    [JsonPropertyName("requestedCode")] public string RequestedCode { get; set; }

    [JsonPropertyName("fsCode")] public string FsCode { get; set; }
}

public class Equipment
{
    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("turboProp")] public bool TurboProp { get; set; }

    [JsonPropertyName("jet")] public bool Jet { get; set; }

    [JsonPropertyName("widebody")] public bool Widebody { get; set; }

    [JsonPropertyName("regional")] public bool Regional { get; set; }
}

public class Operator
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("trafficRestrictions")] public List<object> TrafficRestrictions { get; set; }
}

public class Request
{

    [JsonPropertyName("includeAirports")] public IncludeAirports IncludeAirports { get; set; }

    [JsonPropertyName("excludeAirports")] public ExcludeAirports ExcludeAirports { get; set; }

    [JsonPropertyName("includeAirlines")] public IncludeAirlines IncludeAirlines { get; set; }

    [JsonPropertyName("excludeAirlines")] public ExcludeAirlines ExcludeAirlines { get; set; }

    [JsonPropertyName("numHours")] public NumHours NumHours { get; set; }

    [JsonPropertyName("maxConnections")] public MaxConnections MaxConnections { get; set; }

    [JsonPropertyName("includeSurface")] public IncludeSurface IncludeSurface { get; set; }

    [JsonPropertyName("payloadType")] public PayloadType PayloadType { get; set; }

    [JsonPropertyName("includeCodeshares")]
    public IncludeCodeshares IncludeCodeshares { get; set; }

    [JsonPropertyName("includeMultipleCarriers")]
    public IncludeMultipleCarriers IncludeMultipleCarriers { get; set; }

    [JsonPropertyName("maxResults")] public MaxResults MaxResults { get; set; }
}

public class Connection
{
    [JsonPropertyName("elapsedTime")] public int ElapsedTime { get; set; }

    [JsonPropertyName("score")] public int Score { get; set; }

    [JsonPropertyName("scheduledFlight")] public List<ScheduledFlight> ScheduledFlight { get; set; }
}

public class Departure
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Arrival
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}


public class ScheduledFlight
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonPropertyName("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonPropertyName("departureTime")] public DateTimeOffset DepartureTime { get; set; }

    [JsonPropertyName("arrivalTime")] public DateTimeOffset ArrivalTime { get; set; }

    [JsonPropertyName("stops")] public int Stops { get; set; }

    [JsonPropertyName("departureTerminal")] public string DepartureTerminal { get; set; }

    [JsonPropertyName("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonPropertyName("flightEquipmentIataCode")]
    public string FlightEquipmentIataCode { get; set; }

    [JsonPropertyName("isCodeshare")] public bool IsCodeShare { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("elapsedTime")] public int ElapsedTime { get; set; }

}