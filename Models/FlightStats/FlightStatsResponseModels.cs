using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;

public class Airline
{
    [JsonPropertyName("fs")] public string Fs { get; init; }

    [JsonPropertyName("iata")] public string Iata { get; init; }

    [JsonPropertyName("icao")] public string Icao { get; init; }

    [JsonPropertyName("name")] public string Name { get; init; }

    [JsonPropertyName("active")] public bool? Active { get; init; }

    [JsonPropertyName("category")] public string Category { get; init; }
}

public class Airport
{
    [JsonPropertyName("fs")] public string Fs { get; init; }

    [JsonPropertyName("iata")] public string Iata { get; init; }

    [JsonPropertyName("icao")] public string Icao { get; init; }

    [JsonPropertyName("faa")] public string Faa { get; init; }

    [JsonPropertyName("name")] public string Name { get; init; }

    [JsonPropertyName("street1")] public string Street1 { get; init; }

    [JsonPropertyName("city")] public string City { get; init; }

    [JsonPropertyName("cityCode")] public string CityCode { get; init; }

    [JsonPropertyName("stateCode")] public string StateCode { get; init; }

    [JsonPropertyName("postalCode")] public string PostalCode { get; init; }

    [JsonPropertyName("countryCode")] public string CountryCode { get; init; }

    [JsonPropertyName("countryName")] public string CountryName { get; init; }

    [JsonPropertyName("regionName")] public string RegionName { get; init; }

    [JsonPropertyName("regionIata")] public string RegionIata { get; init; }

    [JsonPropertyName("timeZoneRegionName")]
    public string TimeZoneRegionName { get; init; }

    [JsonPropertyName("weatherZone")] public string WeatherZone { get; init; }

    [JsonPropertyName("localTime")] public string LocalTime { get; init; }

    [JsonPropertyName("utcOffsetHours")] public double? UtcOffsetHours { get; init; }

    [JsonPropertyName("latitude")] public double? Latitude { get; init; }

    [JsonPropertyName("longitude")] public double? Longitude { get; init; }

    [JsonPropertyName("elevationFeet")] public int? ElevationFeet { get; init; }

    [JsonPropertyName("classification")] public int? Classification { get; init; }

    [JsonPropertyName("active")] public bool? Active { get; init; }

    [JsonPropertyName("street2")] public string Street2 { get; init; }
}

public class AllowNearbyArrivals
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; init; }
}

public class AllowNearbyDepartures
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; init; }
}

public class Appendix
{
    [JsonPropertyName("airlines")] public List<Airline> Airlines { get; init; }

    [JsonPropertyName("airports")] public List<Airport> Airports { get; init; }

    [JsonPropertyName("equipments")] public List<Equipment> Equipments { get; init; }
}

public class Arrival
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class FlightStatsCodeshare
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; init; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; init; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; init; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; init; }

    [JsonPropertyName("trafficRestrictions")]
    public List<object> TrafficRestrictions { get; init; }
}

public class Connection
{
    [JsonPropertyName("elapsedTime")] public int? ElapsedTime { get; init; }

    [JsonPropertyName("score")] public int? Score { get; init; }

    [JsonPropertyName("scheduledFlight")] public List<ScheduledFlight> ScheduledFlight { get; init; }
}

public class FlightStatsRequestDate
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class FlightStatusRequestDateTime
{
    [JsonPropertyName("year")] public string Year { get; init; }

    [JsonPropertyName("month")] public string Month { get; init; }

    [JsonPropertyName("day")] public string Day { get; init; }

    [JsonPropertyName("hour")] public string Hour { get; init; }

    [JsonPropertyName("minute")] public string Minute { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class Departure
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class Equipment
{
    [JsonPropertyName("iata")] public string Iata { get; init; }

    [JsonPropertyName("name")] public string Name { get; init; }

    [JsonPropertyName("turboProp")] public bool? TurboProp { get; init; }

    [JsonPropertyName("jet")] public bool? Jet { get; init; }

    [JsonPropertyName("widebody")] public bool? Widebody { get; init; }

    [JsonPropertyName("regional")] public bool? Regional { get; init; }
}

public class ExcludeAirlines
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; init; }
}

public class ExcludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; init; }
}

public class ExtendedOptions
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class IncludeAirlines
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public List<string> Interpreted { get; init; }
}

public class IncludeAirports
{
    [JsonPropertyName("interpreted")] public List<object> Interpreted { get; init; }
}

public class IncludeCodeshares
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public bool? Interpreted { get; init; }
}

public class IncludeMultipleCarriers
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; init; }
}

public class IncludeSurface
{
    [JsonPropertyName("interpreted")] public bool? Interpreted { get; init; }
}

public class MaxConnections
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; init; }
}

public class MaxResults
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; init; }
}

public class MinimumConnectTime
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; init; }
}

public class NumHours
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public int? Interpreted { get; init; }
}

public class PayloadType
{
    [JsonPropertyName("requested")] public string Requested { get; init; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; init; }
}

public class Request
{
    [JsonPropertyName("endpoint")] public string Endpoint { get; init; }

    [JsonPropertyName("departure")] public Departure Departure { get; init; }

    [JsonPropertyName("arrival")] public Arrival Arrival { get; init; }

    [JsonPropertyName("allowNearbyDepartures")]
    public AllowNearbyDepartures AllowNearbyDepartures { get; init; }

    [JsonPropertyName("allowNearbyArrivals")]
    public AllowNearbyArrivals AllowNearbyArrivals { get; init; }

    [JsonPropertyName("includeAirports")] public IncludeAirports IncludeAirports { get; init; }

    [JsonPropertyName("excludeAirports")] public ExcludeAirports ExcludeAirports { get; init; }

    [JsonPropertyName("includeAirlines")] public IncludeAirlines IncludeAirlines { get; init; }

    [JsonPropertyName("excludeAirlines")] public ExcludeAirlines ExcludeAirlines { get; init; }

    [JsonPropertyName("numHours")] public NumHours NumHours { get; init; }

    [JsonPropertyName("maxConnections")] public MaxConnections MaxConnections { get; init; }

    [JsonPropertyName("includeSurface")] public IncludeSurface IncludeSurface { get; init; }

    [JsonPropertyName("payloadType")] public PayloadType PayloadType { get; init; }

    [JsonPropertyName("includeCodeshares")]
    public IncludeCodeshares IncludeCodeshares { get; init; }

    [JsonPropertyName("includeMultipleCarriers")]
    public IncludeMultipleCarriers IncludeMultipleCarriers { get; init; }

    [JsonPropertyName("maxResults")] public MaxResults MaxResults { get; init; }

    [JsonPropertyName("date")] public FlightStatsRequestDate Date { get; init; }

    [JsonPropertyName("minimumConnectTime")]
    public MinimumConnectTime MinimumConnectTime { get; init; }

    [JsonPropertyName("url")] public string Url { get; init; }

    [JsonPropertyName("extendedOptions")] public ExtendedOptions ExtendedOptions { get; init; }

    [JsonPropertyName("dateTime")] public FlightStatusRequestDateTime DateTime { get; init; }
}

public class FlightConnectionsRoot
{
    [JsonPropertyName("request")] public Request Request { get; init; }

    [JsonPropertyName("connections")] public List<Connection> Connections { get; init; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; init; }
}

public class ScheduledFlight
{
    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; init; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; init; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; init; }

    [JsonPropertyName("arrivalAirportFsCode")]
    public string ArrivalAirportFsCode { get; init; }

    [JsonPropertyName("departureTime")] public string DepartureTime { get; init; }

    [JsonPropertyName("arrivalTime")] public string ArrivalTime { get; init; }

    [JsonPropertyName("stops")] public int? Stops { get; init; }

    [JsonPropertyName("departureTerminal")]
    public string DepartureTerminal { get; init; }

    [JsonPropertyName("arrivalTerminal")] public string ArrivalTerminal { get; init; }

    [JsonPropertyName("flightEquipmentIataCode")]
    public string FlightEquipmentIataCode { get; init; }

    [JsonPropertyName("isCodeshare")] public bool? IsCodeshare { get; init; }

    [JsonPropertyName("isWetlease")] public bool? IsWetlease { get; init; }

    [JsonPropertyName("serviceType")] public string ServiceType { get; init; }

    [JsonPropertyName("serviceClasses")] public List<string> ServiceClasses { get; init; }

    [JsonPropertyName("trafficRestrictions")]
    public List<object> TrafficRestrictions { get; init; }

    [JsonPropertyName("elapsedTime")] public int? ElapsedTime { get; init; }

    [JsonPropertyName("codeshares")] public List<Codeshare> Codeshares { get; init; }

    [JsonPropertyName("wetleaseOperatorFsCode")]
    public string WetleaseOperatorFsCode { get; init; }
}