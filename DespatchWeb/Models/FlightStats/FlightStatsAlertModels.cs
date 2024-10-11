using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace DespatchWeb.Models.FlightStats;

public class AlertPayload
{
    [JsonProperty("request")] public Request Request { get; set; }

    [JsonProperty("alert")] public Alert Alert { get; set; }

    [JsonProperty("appendix")] public Appendix Appendix { get; set; }
}

public class ActualGateArrival
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class ActualGateDeparture
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class AirportResources
{
    [JsonProperty("departureTerminal")] public string DepartureTerminal { get; set; }

    [JsonProperty("departureGate")] public string DepartureGate { get; set; }

    [JsonProperty("arrivalTerminal")] public string ArrivalTerminal { get; set; }

    [JsonProperty("arrivalGate")] public string ArrivalGate { get; set; }

    [JsonProperty("baggage")] public string Baggage { get; set; }
}

public class Alert
{
    [JsonProperty("rule")] public Rule Rule { get; set; }

    [JsonProperty("flightStatus")] public FlightStatus FlightStatus { get; set; }

    [JsonProperty("event")] public Event Event { get; set; }

    [JsonProperty("dataSource")] public string DataSource { get; set; }

    [JsonProperty("dateTimeRecorded")] public DateTime DateTimeRecorded { get; set; }
}

public class AlertType
{
    [JsonProperty("requested")] public string Requested { get; set; }

    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class ArrivalDate
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class ConfirmedIncident
{
    [JsonProperty("publishedDate")] public DateTime PublishedDate { get; set; }

    [JsonProperty("message")] public string Message { get; set; }
}

public class DepartureDate
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class Description
{
    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class EstimatedGateArrival
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class EstimatedGateDeparture
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class Event2
{
    [JsonProperty("type")] public string Type { get; set; }
}

public class FlightDurations
{
    [JsonProperty("blockMinutes")] public int BlockMinutes { get; set; }
}

public class FlightEquipment
{
    [JsonProperty("scheduledEquipmentIataCode")]
    public string ScheduledEquipmentIataCode { get; set; }

    [JsonProperty("actualEquipmentIataCode")]
    public string ActualEquipmentIataCode { get; set; }

    [JsonProperty("tailNumber")] public string TailNumber { get; set; }
}

public class FlightStatus
{
    [JsonProperty("flightId")] public int FlightId { get; set; }

    [JsonProperty("carrierFsCode")] public string CarrierFsCode { get; set; }

    [JsonProperty("operatingCarrierFsCode")]
    public string OperatingCarrierFsCode { get; set; }

    [JsonProperty("primaryCarrierFsCode")] public string PrimaryCarrierFsCode { get; set; }

    [JsonProperty("flightNumber")] public string FlightNumber { get; set; }

    [JsonProperty("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonProperty("arrivalAirportFsCode")] public string ArrivalAirportFsCode { get; set; }

    [JsonProperty("departureDate")] public DepartureDate DepartureDate { get; set; }

    [JsonProperty("arrivalDate")] public ArrivalDate ArrivalDate { get; set; }

    [JsonProperty("status")] public string Status { get; set; }

    [JsonProperty("schedule")] public Schedule Schedule { get; set; }

    [JsonProperty("operationalTimes")] public OperationalTimes OperationalTimes { get; set; }

    [JsonProperty("codeshares")] public List<CodeShare> CodeShares { get; set; }

    [JsonProperty("flightDurations")] public FlightDurations FlightDurations { get; set; }

    [JsonProperty("airportResources")] public AirportResources AirportResources { get; set; }

    [JsonProperty("flightEquipment")] public FlightEquipment FlightEquipment { get; set; }

    [JsonProperty("flightStatusUpdates")] public List<FlightStatusUpdate> FlightStatusUpdates { get; set; }

    [JsonProperty("irregularOperations")] public List<IrregularOperation> IrregularOperations { get; set; }

    [JsonProperty("confirmedIncident")] public ConfirmedIncident ConfirmedIncident { get; set; }
}

public class FlightStatusUpdate
{
    [JsonProperty("updatedAt")] public UpdatedAt UpdatedAt { get; set; }

    [JsonProperty("source")] public string Source { get; set; }

    [JsonProperty("updatedTextFields")] public List<object> UpdatedTextFields { get; set; }

    [JsonProperty("updatedDateFields")] public List<UpdatedDateField> UpdatedDateFields { get; set; }
}

public class IrregularOperation
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("message")] public string Message { get; set; }

    [JsonProperty("relatedFlightId")] public int RelatedFlightId { get; set; }

    [JsonProperty("newArrivalAirportFsCode")]
    public string NewArrivalAirportFsCode { get; set; }
}

public class OperationalTimes
{
    [JsonProperty("publishedDeparture")] public PublishedDeparture PublishedDeparture { get; set; }

    [JsonProperty("estimatedGateDeparture")]
    public EstimatedGateDeparture EstimatedGateDeparture { get; set; }

    [JsonProperty("actualGateDeparture")] public ActualGateDeparture ActualGateDeparture { get; set; }

    [JsonProperty("publishedArrival")] public PublishedArrival PublishedArrival { get; set; }

    [JsonProperty("estimatedGateArrival")] public EstimatedGateArrival EstimatedGateArrival { get; set; }

    [JsonProperty("actualGateArrival")] public ActualGateArrival ActualGateArrival { get; set; }
}

public class PublishedArrival
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class PublishedDeparture
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }

    [JsonProperty("dateLocal")] public DateTime DateLocal { get; set; }
}

public class Schedule
{
    [JsonProperty("flightType")] public string FlightType { get; set; }

    [JsonProperty("serviceClasses")] public string ServiceClasses { get; set; }

    [JsonProperty("uplines")] public List<object> Uplines { get; set; }

    [JsonProperty("downlines")] public List<object> Downlines { get; set; }
}

public class Type
{
    [JsonProperty("requested")] public string Requested { get; set; }

    [JsonProperty("interpreted")] public string Interpreted { get; set; }
}

public class UpdatedAt
{
    [JsonProperty("dateUtc")] public DateTime DateUtc { get; set; }
}

public class UpdatedDateField
{
    [JsonProperty("field")] public string Field { get; set; }

    [JsonProperty("originalDateLocal")] public DateTime OriginalDateLocal { get; set; }

    [JsonProperty("newDateLocal")] public DateTime NewDateLocal { get; set; }
}