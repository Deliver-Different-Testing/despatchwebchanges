using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace DespatchWeb.Models.FlightStats;

public class AlertPayload
{
    [JsonProperty("alert")] public Alert Alert { get; set; }
}

public class ActualEquipment
{
    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("jet")] public string Jet { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("regional")] public string Regional { get; set; }

    [JsonProperty("turboProp")] public string TurboProp { get; set; }

    [JsonProperty("widebody")] public string Widebody { get; set; }
}

public class ActualGateDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class ActualRunwayDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class AirportResources
{
    [JsonProperty("arrivalGate")] public string ArrivalGate { get; set; }

    [JsonProperty("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonProperty("departureGate")] public string DepartureGate { get; set; }

    [JsonProperty("departureTerminal")] public string DepartureTerminal { get; set; }
}

public class Alert
{
    [JsonProperty("dataSource")] public string DataSource { get; set; }

    [JsonProperty("dateTimeRecorded")] public DateTime DateTimeRecorded { get; set; }

    [JsonProperty("event")] public WebhookEvent Event { get; set; }

    [JsonProperty("flightStatus")] public FlightStatus FlightStatus { get; set; }

    [JsonProperty("rule")] public Rule Rule { get; set; }
}

public class WebhookEvent
{
    [JsonProperty("type")] public string Type { get; set; }

    [JsonProperty("value")] public string Value { get; set; }
}

public class ArrivalDate
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class Codeshare
{
    [JsonProperty("carrier")] public Carrier Carrier { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("relationship")] public string Relationship { get; set; }
}

public class Codeshares
{
    [JsonProperty("codeshare")] public List<Codeshare> Codeshare { get; set; }
}

public class Delays
{
    [JsonProperty("arrivalRunwayDelayMinutes")]
    public string ArrivalRunwayDelayMinutes { get; set; }
}

public class DepartureDate
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class EstimatedGateArrival
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class EstimatedGateDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class EstimatedRunwayArrival
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class EstimatedRunwayDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class FlightDurations
{
    [JsonProperty("scheduledAirMinutes")] public string ScheduledAirMinutes { get; set; }

    [JsonProperty("scheduledBlockMinutes")]
    public string ScheduledBlockMinutes { get; set; }

    [JsonProperty("scheduledTaxiInMinutes")]
    public string ScheduledTaxiInMinutes { get; set; }

    [JsonProperty("scheduledTaxiOutMinutes")]
    public string ScheduledTaxiOutMinutes { get; set; }

    [JsonProperty("taxiOutMinutes")] public string TaxiOutMinutes { get; set; }
}

public class FlightEquipment
{
    [JsonProperty("actualEquipment")] public ActualEquipment ActualEquipment { get; set; }

    [JsonProperty("scheduledEquipment")] public ScheduledEquipment ScheduledEquipment { get; set; }
}

public class FlightPlanPlannedArrival
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class FlightPlanPlannedDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class FlightStatus
{
    [JsonProperty("airportResources")] public AirportResources AirportResources { get; set; }

    [JsonProperty("arrivalAirport")] public ArrivalAirport ArrivalAirport { get; set; }

    [JsonProperty("arrivalDate")] public ArrivalDate ArrivalDate { get; set; }

    [JsonProperty("carrier")] public Carrier Carrier { get; set; }

    [JsonProperty("codeshares")] public Codeshares Codeshares { get; set; }

    [JsonProperty("delays")] public Delays Delays { get; set; }

    [JsonProperty("departureAirport")] public DepartureAirport DepartureAirport { get; set; }

    [JsonProperty("departureDate")] public DepartureDate DepartureDate { get; set; }

    [JsonProperty("flightDurations")] public FlightDurations FlightDurations { get; set; }

    [JsonProperty("flightEquipment")] public FlightEquipment FlightEquipment { get; set; }

    [JsonProperty("flightId")] public string FlightId { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("flightStatusUpdates")] public FlightStatusUpdates FlightStatusUpdates { get; set; }

    [JsonProperty("operationalTimes")] public OperationalTimes OperationalTimes { get; set; }

    [JsonProperty("schedule")] public Schedule Schedule { get; set; }

    [JsonProperty("status")] public string Status { get; set; }
}

public class FlightStatusUpdate
{
    [JsonProperty("source")] public string Source { get; set; }

    [JsonProperty("updatedAt")] public UpdatedAt UpdatedAt { get; set; }

    [JsonProperty("updatedDateFields")] public UpdatedDateFields UpdatedDateFields { get; set; }

    [JsonProperty("updatedTextFields")] public UpdatedTextFields UpdatedTextFields { get; set; }
}

public class FlightStatusUpdates
{
    [JsonProperty("flightStatusUpdate")] public List<FlightStatusUpdate> FlightStatusUpdate { get; set; }
}

public class OperationalTimes
{
    [JsonProperty("actualGateDeparture")] public ActualGateDeparture ActualGateDeparture { get; set; }

    [JsonProperty("actualRunwayDeparture")]
    public ActualRunwayDeparture ActualRunwayDeparture { get; set; }

    [JsonProperty("estimatedGateArrival")] public EstimatedGateArrival EstimatedGateArrival { get; set; }

    [JsonProperty("estimatedGateDeparture")]
    public EstimatedGateDeparture EstimatedGateDeparture { get; set; }

    [JsonProperty("estimatedRunwayArrival")]
    public EstimatedRunwayArrival EstimatedRunwayArrival { get; set; }

    [JsonProperty("estimatedRunwayDeparture")]
    public EstimatedRunwayDeparture EstimatedRunwayDeparture { get; set; }

    [JsonProperty("flightPlanPlannedArrival")]
    public FlightPlanPlannedArrival FlightPlanPlannedArrival { get; set; }

    [JsonProperty("flightPlanPlannedDeparture")]
    public FlightPlanPlannedDeparture FlightPlanPlannedDeparture { get; set; }

    [JsonProperty("publishedArrival")] public PublishedArrival PublishedArrival { get; set; }

    [JsonProperty("publishedDeparture")] public PublishedDeparture PublishedDeparture { get; set; }

    [JsonProperty("scheduledGateArrival")] public ScheduledGateArrival ScheduledGateArrival { get; set; }

    [JsonProperty("scheduledGateDeparture")]
    public ScheduledGateDeparture ScheduledGateDeparture { get; set; }
}

public class PublishedArrival
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class PublishedDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class RuleEvents
{
    [JsonProperty("ruleEvent")] public RuleEvent RuleEvent { get; set; }
}

public class Schedule
{
    [JsonProperty("flightType")] public string FlightType { get; set; }

    [JsonProperty("restrictions")] public string Restrictions { get; set; }

    [JsonProperty("serviceClasses")] public string ServiceClasses { get; set; }
}

public class ScheduledEquipment
{
    [JsonProperty("iata")] public string Iata { get; set; }

    [JsonProperty("jet")] public string Jet { get; set; }

    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("regional")] public string Regional { get; set; }

    [JsonProperty("turboProp")] public string TurboProp { get; set; }

    [JsonProperty("widebody")] public string Widebody { get; set; }
}

public class ScheduledGateArrival
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class ScheduledGateDeparture
{
    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }

    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class UpdatedAt
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class UpdatedDateFields
{
    [JsonProperty("updatedDateField")] public object UpdatedDateField { get; set; }
}

public class UpdatedTextFields
{
    [JsonProperty("updatedTextField")] public object UpdatedTextField { get; set; }
}
