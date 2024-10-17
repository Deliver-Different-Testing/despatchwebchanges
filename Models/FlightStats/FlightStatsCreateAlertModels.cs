using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using ThirdParty.Json.LitJson;

namespace DespatchWeb.Models.FlightStats;

public class CreateAlertResponse
{
    [JsonPropertyName("request")] public Request Request { get; set; }

    [JsonPropertyName("rule")] public Rule Rule { get; set; }

    [JsonPropertyName("alertCapabilities")] public AlertCapabilities AlertCapabilities { get; set; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; set; }
}
public class RetrieveAlertResponse
{
    [JsonPropertyName("request")] public Request Request { get; set; }

    [JsonPropertyName("rule")] public Rule Rule { get; set; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; set; }
}

public class AirlineCode
{
    [JsonPropertyName("fsCode")] public string FsCode { get; set; }

    [JsonPropertyName("requestedCode")] public string RequestedCode { get; set; }
}

public class Airport2
{
    [JsonPropertyName("fs")] public string Fs { get; set; }

    [JsonPropertyName("iata")] public string Iata { get; set; }

    [JsonPropertyName("icao")] public string Icao { get; set; }

    [JsonPropertyName("faa")] public string Faa { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("street1")] public string Street1 { get; set; }

    [JsonPropertyName("street2")] public string Street2 { get; set; }

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

    [JsonPropertyName("utcOffsetHours")] public int UtcOffsetHours { get; set; }

    [JsonPropertyName("latitude")] public double Latitude { get; set; }

    [JsonPropertyName("longitude")] public double Longitude { get; set; }

    [JsonPropertyName("elevationFeet")] public int ElevationFeet { get; set; }

    [JsonPropertyName("classification")] public int Classification { get; set; }

    [JsonPropertyName("active")] public bool Active { get; set; }
}

public class AlertCapabilities
{
    [JsonPropertyName("baggage")] public bool Baggage { get; set; }

    [JsonPropertyName("departureGateChange")] public bool DepartureGateChange { get; set; }

    [JsonPropertyName("arrivalGateChange")] public bool ArrivalGateChange { get; set; }

    [JsonPropertyName("gateDeparture")] public bool GateDeparture { get; set; }

    [JsonPropertyName("gateArrival")] public bool GateArrival { get; set; }

    [JsonPropertyName("runwayDeparture")] public bool RunwayDeparture { get; set; }

    [JsonPropertyName("runwayArrival")] public bool RunwayArrival { get; set; }
}

public class CodeType
{
    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class DeliverTo
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Delivery
{
    [JsonPropertyName("format")] public string Format { get; set; }

    [JsonPropertyName("destination")] public string Destination { get; set; }
}

public class Event
{
    [JsonPropertyName("requested")] public string Requested { get; set; }
}

public class ExtendedOptions
{
    [JsonPropertyName("requested")] public string Requested { get; set; }

    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Name
{
    [JsonPropertyName("interpreted")] public string Interpreted { get; set; }
}

public class Rule
{
    [JsonPropertyName("id")] public string Id { get; set; }

    [JsonPropertyName("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")] public string FlightNumber { get; set; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonPropertyName("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonPropertyName("departure")] public DateTime Departure { get; set; }

    [JsonPropertyName("arrival")] public DateTime Arrival { get; set; }

    [JsonPropertyName("name")] public string Name { get; set; }

    [JsonPropertyName("ruleEvents")] public List<RuleEvent> RuleEvents { get; set; }

    [JsonPropertyName("nameValues")] public List<object> NameValues { get; set; }

    [JsonPropertyName("delivery")] public Delivery Delivery { get; set; }
}

public class RuleEvent
{
    [JsonPropertyName("type")] public string Type { get; set; }

    [JsonPropertyName("value")] public int? Value { get; set; }
}