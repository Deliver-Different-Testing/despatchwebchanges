using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace DespatchWeb.Models.FlightStats;

public class CreateAlertResponse
{
    [JsonProperty("request")] public Request Request { get; set; }

    [JsonProperty("rule")] public Rule Rule { get; set; }

    [JsonProperty("alertCapabilities")] public AlertCapabilities AlertCapabilities { get; set; }

    [JsonProperty("appendix")] public Appendix Appendix { get; set; }
}

public class RetrieveAlertResponse
{
    [JsonProperty("request")] public Request Request { get; set; }

    [JsonProperty("rule")] public Rule Rule { get; set; }

    [JsonProperty("appendix")] public Appendix Appendix { get; set; }
}

public class AirlineCode
{
    [JsonProperty("fsCode")] public string FsCode { get; set; }

    [JsonProperty("requestedCode")] public string RequestedCode { get; set; }
}

public class Airport2
{
    [JsonProperty("fs")] public string Fs { get; set; }

    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("icao")] public string Icao { get; set; }

    [JsonProperty("faa")] public string Faa { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("street1")] public string Street1 { get; set; }

    [JsonProperty("street2")] public string Street2 { get; set; }

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

    [JsonProperty("utcOffsetHours")] public int UtcOffsetHours { get; set; }

    [JsonProperty("latitude")] public double Latitude { get; set; }

    [JsonProperty("longitude")] public double Longitude { get; set; }

    [JsonProperty("elevationFeet")] public int ElevationFeet { get; set; }

    [JsonProperty("classification")] public int Classification { get; set; }

    [JsonProperty("active")] public bool Active { get; set; }
}

public class AlertCapabilities
{
    [JsonProperty("baggage")] public bool Baggage { get; set; }

    [JsonProperty("departureGateChange")] public bool DepartureGateChange { get; set; }

    [JsonProperty("arrivalGateChange")] public bool ArrivalGateChange { get; set; }

    [JsonProperty("gateDeparture")] public bool GateDeparture { get; set; }

    [JsonProperty("gateArrival")] public bool GateArrival { get; set; }

    [JsonProperty("runwayDeparture")] public bool RunwayDeparture { get; set; }

    [JsonProperty("runwayArrival")] public bool RunwayArrival { get; set; }
}

public class CodeType
{
    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class DeliverTo
{
    [JsonProperty("requested")] public string Requested { get; set; }

    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class Delivery
{
    [JsonProperty("format")] public string Format { get; set; }

    [JsonProperty("destination")] public string Destination { get; set; }
}

public class Event
{
    [JsonProperty("requested")] public string Requested { get; set; }
}

public class ExtendedOptions
{
    [JsonProperty("requested")] public string Requested { get; set; }

    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class Name
{
    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class Rule
{
    [JsonProperty("id")] public string Id { get; set; }

    [JsonProperty("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonProperty("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonProperty("departure")] public DateTime Departure { get; set; }

    [JsonProperty("arrival")] public DateTime Arrival { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("ruleEvents")] public List<RuleEvent> RuleEvents { get; set; }

    [JsonProperty("nameValues")] public List<object> NameValues { get; set; }

    [JsonProperty("delivery")] public Delivery Delivery { get; set; }
}

public class RuleEvent
{
    [JsonProperty("type")] public string Type { get; set; }

    [JsonProperty("value")] public int? Value { get; set; }
}