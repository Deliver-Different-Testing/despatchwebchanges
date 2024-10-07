using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace DespatchWeb.Models;

public class FlightStatusResponse
{
    [JsonProperty("request")] public Request Request { get; set; }

    [JsonProperty("scheduledFlights")] public List<ScheduledFlight> ScheduledFlights { get; set; }

    [JsonProperty("appendix")] public Appendix Appendix { get; set; }
}

public class Airline
{
    [JsonProperty("fs")] public string Fs { get; set; }

    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("icao")] public string Icao { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("active")] public bool Active { get; set; }
}

public class Airport
{
    [JsonProperty("fs")] public string Fs { get; set; }

    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("icao")] public string Icao { get; set; }

    [JsonProperty("faa")] public string Faa { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("street1")] public string Street1 { get; set; }

    [JsonProperty("city")] public string City { get; set; }

    [JsonProperty("cityCode")] public string CityCode { get; set; }

    [JsonProperty("stateCode")] public string StateCode { get; set; }

    [JsonProperty("postalCode")] public string PostalCode { get; set; }

    [JsonProperty("countryCode")] public string CountryCode { get; set; }

    [JsonProperty("countryName")] public string CountryName { get; set; }

    [JsonProperty("regionName")] public string RegionName { get; set; }

    [JsonProperty("timeZoneRegionName")] public string TimeZoneRegionName { get; set; }

    [JsonProperty("weatherZone")] public string WeatherZone { get; set; }

    [JsonProperty("localTime")] public DateTime LocalTime { get; set; }

    [JsonProperty("utcOffsetHours")] public double UtcOffsetHours { get; set; }

    [JsonProperty("latitude")] public double Latitude { get; set; }

    [JsonProperty("longitude")] public double Longitude { get; set; }

    [JsonProperty("elevationFeet")] public int ElevationFeet { get; set; }

    [JsonProperty("classification")] public int Classification { get; set; }

    [JsonProperty("active")] public bool Active { get; set; }
}

public class Appendix
{
    [JsonProperty("airlines")] public List<Airline> Airlines { get; set; }

    [JsonProperty("airports")] public List<Airport> Airports { get; set; }

    [JsonProperty("equipments")] public List<Equipment> Equipments { get; set; }
}

public class ArrivalAirport
{
    [JsonProperty("requestedCode")] public string RequestedCode { get; set; }

    [JsonProperty("fsCode")] public string FsCode { get; set; }
}

public class CodeShare
{
    [JsonProperty("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("serviceType")] public string ServiceType { get; set; }

    [JsonProperty("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonProperty("trafficRestrictions")] public List<string> TrafficRestrictions { get; set; }

    [JsonProperty("referenceCode")] public int ReferenceCode { get; set; }
}

public class Date
{
    [JsonProperty("year")] public string Year { get; set; }

    [JsonProperty("month")] public string Month { get; set; }

    [JsonProperty("day")] public string Day { get; set; }

    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class DepartureAirport
{
    [JsonProperty("requestedCode")] public string RequestedCode { get; set; }

    [JsonProperty("fsCode")] public string FsCode { get; set; }
}

public class Equipment
{
    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("turboProp")] public bool TurboProp { get; set; }

    [JsonProperty("jet")] public bool Jet { get; set; }

    [JsonProperty("widebody")] public bool Widebody { get; set; }

    [JsonProperty("regional")] public bool Regional { get; set; }
}

public class Operator
{
    [JsonProperty("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("serviceType")] public string ServiceType { get; set; }

    [JsonProperty("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonProperty("trafficRestrictions")] public List<object> TrafficRestrictions { get; set; }
}

public class Request
{
    [JsonProperty("departing")] public bool Departing { get; set; }

    [JsonProperty("url")] public string Url { get; set; }

    [JsonProperty("departureAirport")] public DepartureAirport DepartureAirport { get; set; }

    [JsonProperty("arrivalAirport")] public ArrivalAirport ArrivalAirport { get; set; }

    [JsonProperty("date")] public Date Date { get; set; }
}

public class ScheduledFlight
{
    [JsonProperty("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonProperty("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonProperty("departureTime")] public DateTime DepartureTime { get; set; }

    [JsonProperty("arrivalTime")] public DateTime ArrivalTime { get; set; }

    [JsonProperty("stops")] public int Stops { get; set; }

    [JsonProperty("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonProperty("flightEquipmentIataCode")]
    public string FlightEquipmentIataCode { get; set; }

    [JsonProperty("isCodeshare")] public bool IsCodeShare { get; set; }

    [JsonProperty("isWetlease")] public bool IsWetLease { get; set; }

    [JsonProperty("serviceType")] public string ServiceType { get; set; }

    [JsonProperty("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonProperty("trafficRestrictions")] public List<string> TrafficRestrictions { get; set; }

    [JsonProperty("codeshares")] public List<CodeShare> CodeShares { get; set; }

    [JsonProperty("referenceCode")] public string ReferenceCode { get; set; }

    [JsonProperty("operator")] public Operator Operator { get; set; }
}
