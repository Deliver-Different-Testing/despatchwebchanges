using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;

public class Airline
{
    [JsonPropertyName("fs")] public string Fs { get; set; }

    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("icao")] public string Icao { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("active")] public bool? Active { get; set; }

    [JsonPropertyName("category")] public string Category { get; set; }
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

    [JsonPropertyName("regionIata")] public string RegionIata { get; set; }

    [JsonPropertyName("timeZoneRegionName")]
    public string TimeZoneRegionName { get; set; }

    [JsonPropertyName("weatherZone")] public string WeatherZone { get; set; }

    [JsonPropertyName("localTime")] public string LocalTime { get; set; }

    [JsonPropertyName("utcOffsetHours")] public double? UtcOffsetHours { get; set; }

    [JsonPropertyName("latitude")] public double? Latitude { get; set; }

    [JsonPropertyName("longitude")] public double? Longitude { get; set; }

    [JsonPropertyName("elevationFeet")] public int? ElevationFeet { get; set; }

    [JsonPropertyName("classification")] public int? Classification { get; set; }

    [JsonPropertyName("active")] public bool? Active { get; set; }

    [JsonPropertyName("street2")] public string Street2 { get; set; }
}

public class AllowNearbyArrivals
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; set; }
}

public class AllowNearbyDepartures
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; set; }
}

public class Appendix
{
    [JsonPropertyName("airlines")] public List<Airline> Airlines { get; set; }

    [JsonPropertyName("airports")] public List<Airport> Airports { get; set; }

    [JsonPropertyName("equipments")] public List<Equipment> Equipments { get; set; }
}

public class Arrival
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class FlightStatsCodeshare
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("trafficRestrictions")]
    public List<object> TrafficRestrictions { get; set; }
}

public class Connection
{
    [JsonPropertyName("elapsedTime")] public int? ElapsedTime { get; set; }

    [JsonPropertyName("score")] public int? Score { get; set; }

    [JsonPropertyName("scheduledFlight")] public List<ScheduledFlight> ScheduledFlight { get; set; }
}

public class FlightStatsRequestDate
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class FlightStatusRequestDateTime
{
    [JsonPropertyName("year")] public string Year { get; set; }

    [JsonPropertyName("month")] public string Month { get; set; }

    [JsonPropertyName("day")] public string Day { get; set; }

    [JsonPropertyName("hour")] public string Hour { get; set; }

    [JsonPropertyName("minute")] public string Minute { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Departure
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Equipment
{
    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("turboProp")] public bool? TurboProp { get; set; }

    [JsonPropertyName("jet")] public bool? Jet { get; set; }

    [JsonPropertyName("widebody")] public bool? Widebody { get; set; }

    [JsonPropertyName("regional")] public bool? Regional { get; set; }
}

public class ExcludeAirlines
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class ExcludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class ExtendedOptions
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class IncludeAirlines
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public List<string> Interpreted { get; set; }
}

public class IncludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; set; }
}

public class IncludeCodeshares
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public bool? Interpreted { get; set; }
}

public class IncludeMultipleCarriers
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; set; }
}

public class IncludeSurface
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; set; }
}

public class MaxConnections
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; set; }
}

public class MaxResults
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; set; }
}

public class MinimumConnectTime
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; set; }
}

public class NumHours
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; set; }
}

public class PayloadType
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Request
{
    [JsonPropertyName("endpoint")] public string Endpoint { get; set; }

    [JsonPropertyName("departure")] public Departure Departure { get; set; }

    [JsonPropertyName("arrival")] public Arrival Arrival { get; set; }

    [JsonPropertyName("allowNearbyDepartures")]
    public AllowNearbyDepartures AllowNearbyDepartures { get; set; }

    [JsonPropertyName("allowNearbyArrivals")]
    public AllowNearbyArrivals AllowNearbyArrivals { get; set; }

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

    [JsonPropertyName("date")] public FlightStatsRequestDate Date { get; set; }

    [JsonPropertyName("minimumConnectTime")]
    public MinimumConnectTime MinimumConnectTime { get; set; }

    [JsonPropertyName("url")] public string Url { get; set; }

    [JsonPropertyName("extendedOptions")] public ExtendedOptions ExtendedOptions { get; set; }

    [JsonPropertyName("dateTime")] public FlightStatusRequestDateTime DateTime { get; set; }
}

public class FlightConnectionsRoot
{
    [JsonPropertyName("request")] public Request Request { get; set; }

    [JsonPropertyName("connections")] public List<Connection> Connections { get; set; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; set; }
}

public class ScheduledFlight
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonPropertyName("arrivalAirportFsCode")]
    public string ArrivalAirportFsCode { get; set; }

    [JsonPropertyName("departureTime")] public string DepartureTime { get; set; }

    [JsonPropertyName("arrivalTime")] public string ArrivalTime { get; set; }

    [JsonPropertyName("stops")] public int? Stops { get; set; }

    [JsonPropertyName("departureTerminal")]
    public string DepartureTerminal { get; set; }

    [JsonPropertyName("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonPropertyName("flightEquipmentIataCode")]
    public string FlightEquipmentIataCode { get; set; }

    [JsonPropertyName("isCodeshare")] public bool? IsCodeshare { get; set; }

    [JsonPropertyName("isWetlease")] public bool? IsWetlease { get; set; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; set; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("trafficRestrictions")]
    public List<object> TrafficRestrictions { get; set; }

    [JsonPropertyName("elapsedTime")] public int? ElapsedTime { get; set; }

    [JsonPropertyName("codeshares")] public List<Codeshare> Codeshares { get; set; }

    [JsonPropertyName("wetleaseOperatorFsCode")]
    public string WetleaseOperatorFsCode { get; set; }
}