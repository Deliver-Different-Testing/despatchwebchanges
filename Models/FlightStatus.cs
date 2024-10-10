using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using ThirdParty.Json.LitJson;

namespace DespatchWeb.Models;

public class FlightSchedulesResponse
{
    [JsonPropertyName("request")] public Request Request { get; set; }

    [JsonPropertyName("scheduledFlights")] public List<ScheduledFlight> ScheduledFlights { get; set; }

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
    [JsonPropertyName("departing")] public bool Departing { get; set; }

    [JsonPropertyName("url")] public string Url { get; set; }

    [JsonPropertyName("departureAirport")] public DepartureAirport DepartureAirport { get; set; }

    [JsonPropertyName("arrivalAirport")] public ArrivalAirport ArrivalAirport { get; set; }

    [JsonPropertyName("date")] public Date Date { get; set; }
}

public class ScheduledFlight
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonPropertyName("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonPropertyName("departureTime")] public DateTime DepartureTime { get; set; }

    [JsonPropertyName("arrivalTime")] public DateTime ArrivalTime { get; set; }

    [JsonPropertyName("stops")] public int Stops { get; set; }

    [JsonPropertyName("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonPropertyName("flightEquipmentIataCode")]
    public string FlightEquipmentIataCode { get; set; }

    [JsonPropertyName("isCodeshare")] public bool IsCodeShare { get; set; }

    [JsonPropertyName("isWetlease")] public bool IsWetLease { get; set; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("trafficRestrictions")] public List<string> TrafficRestrictions { get; set; }

    [JsonPropertyName("codeshares")] public List<CodeShare> CodeShares { get; set; }

    [JsonPropertyName("referenceCode")] public string ReferenceCode { get; set; }

    [JsonPropertyName("operator")] public Operator Operator { get; set; }
}

public class Carrier
{
    [JsonPropertyName("requestedCode")] public string RequestedCode { get; set; }

    [JsonPropertyName("fsCode")] public string FsCode { get; set; }
}

public class FlightNumber
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}
