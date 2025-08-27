using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;


public class FlightStatusResponse
{
    [JsonPropertyName("request")]
    public InterpretedRequest Request { get; set; }

    [JsonPropertyName("error")]
    public ApiResponseError Error { get; set; }

    [JsonPropertyName("appendix")]
    public AppendixWithWrapper Appendix { get; set; }

    [JsonPropertyName("flightStatus")]
    public FlightStatus FlightStatus { get; set; }

    [JsonPropertyName("flightStatuses")]
    public List<FlightStatus> FlightStatuses { get; set; }

    [JsonPropertyName("schema")]
    public string Schema { get; set; }
}

public class InterpretedRequest
{
    [JsonPropertyName("carrier")]
    public string Carrier { get; set; }

    [JsonPropertyName("flight")]
    public string Flight { get; set; }

    [JsonPropertyName("year")]
    public int Year { get; set; }

    [JsonPropertyName("month")]
    public int Month { get; set; }

    [JsonPropertyName("day")]
    public int Day { get; set; }

    [JsonPropertyName("utc")]
    public bool Utc { get; set; }

    [JsonPropertyName("airport")]
    public string Airport { get; set; }

    [JsonPropertyName("codeType")]
    public string CodeType { get; set; }

    [JsonPropertyName("extendedOptions")]
    public List<string> ExtendedOptions { get; set; }

    [JsonPropertyName("url")]
    public string Url { get; set; }
}

public class ApiResponseError
{
    [JsonPropertyName("errorId")]
    public string ErrorId { get; set; }

    [JsonPropertyName("errorCode")]
    public string ErrorCode { get; set; }

    [JsonPropertyName("errorMessage")]
    public string ErrorMessage { get; set; }

    [JsonPropertyName("httpStatusCode")]
    public int HttpStatusCode { get; set; }
}

public class AppendixWithWrapper
{
    [JsonPropertyName("airlines")]
    public List<Airline> Airlines { get; set; }

    [JsonPropertyName("airports")]
    public List<Airport> Airports { get; set; }

    [JsonPropertyName("equipments")]
    public List<Equipment> Equipments { get; set; }
}

public class FlightStatus
{
    [JsonPropertyName("flightId")]
    public long FlightId { get; set; }

    [JsonPropertyName("carrier")]
    public Airline Carrier { get; set; }

    [JsonPropertyName("carrierFsCode")]
    public string CarrierFsCode { get; set; }

    [JsonPropertyName("operatingCarrier")]
    public Airline OperatingCarrier { get; set; }

    [JsonPropertyName("operatingCarrierFsCode")]
    public string OperatingCarrierFsCode { get; set; }

    [JsonPropertyName("primaryCarrier")]
    public Airline PrimaryCarrier { get; set; }

    [JsonPropertyName("primaryCarrierFsCode")]
    public string PrimaryCarrierFsCode { get; set; }

    [JsonPropertyName("flightNumber")]
    public string FlightNumber { get; set; }

    [JsonPropertyName("departureAirport")]
    public Airport DepartureAirport { get; set; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; set; }

    [JsonPropertyName("arrivalAirport")]
    public Airport ArrivalAirport { get; set; }

    [JsonPropertyName("arrivalAirportFsCode")]
    public string ArrivalAirportFsCode { get; set; }

    [JsonPropertyName("divertedAirport")]
    public Airport DivertedAirport { get; set; }

    [JsonPropertyName("divertedAirportFsCode")]
    public string DivertedAirportFsCode { get; set; }

    [JsonPropertyName("departureDate")]
    public DateUtcAndLocal DepartureDate { get; set; }

    [JsonPropertyName("arrivalDate")]
    public DateUtcAndLocal ArrivalDate { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; }

    [JsonPropertyName("schedule")]
    public Schedule Schedule { get; set; }

    [JsonPropertyName("operationalTimes")]
    public OperationalTimes OperationalTimes { get; set; }

    [JsonPropertyName("codeshares")]
    public List<Codeshare> Codeshares { get; set; }

    [JsonPropertyName("delays")]
    public Delays Delays { get; set; }

    [JsonPropertyName("flightDurations")]
    public FlightDurations FlightDurations { get; set; }

    [JsonPropertyName("airportResources")]
    public AirportResources AirportResources { get; set; }

    [JsonPropertyName("flightEquipment")]
    public FlightEquipment FlightEquipment { get; set; }

    [JsonPropertyName("flightStatusUpdates")]
    public List<FlightStatusUpdate> FlightStatusUpdates { get; set; }

    [JsonPropertyName("irregularOperations")]
    public List<IrregularOperation> IrregularOperations { get; set; }

    [JsonPropertyName("confirmedIncident")]
    public ConfirmedIncident ConfirmedIncident { get; set; }

    [JsonPropertyName("lastDataAcquiredDate")]
    public DateTime? LastDataAcquiredDate { get; set; }
}

public class DateUtcAndLocal
{
    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; set; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; set; }
}

public class Schedule
{
    [JsonPropertyName("flightType")]
    public string FlightType { get; set; }

    [JsonPropertyName("serviceClasses")]
    public List<string> ServiceClasses { get; set; }

    [JsonPropertyName("restrictions")]
    public List<string> Restrictions { get; set; }
}

public class OperationalTimes
{
    [JsonPropertyName("publishedDeparture")]
    public DateUtcAndLocal PublishedDeparture { get; set; }

    [JsonPropertyName("publishedArrival")]
    public DateUtcAndLocal PublishedArrival { get; set; }

    [JsonPropertyName("scheduledGateDeparture")]
    public DateUtcAndLocal ScheduledGateDeparture { get; set; }

    [JsonPropertyName("estimatedGateDeparture")]
    public DateUtcAndLocal EstimatedGateDeparture { get; set; }

    [JsonPropertyName("actualGateDeparture")]
    public DateUtcAndLocal ActualGateDeparture { get; set; }

    [JsonPropertyName("scheduledGateArrival")]
    public DateUtcAndLocal ScheduledGateArrival { get; set; }

    [JsonPropertyName("estimatedGateArrival")]
    public DateUtcAndLocal EstimatedGateArrival { get; set; }

    [JsonPropertyName("actualGateArrival")]
    public DateUtcAndLocal ActualGateArrival { get; set; }

    [JsonPropertyName("scheduledRunwayDeparture")]
    public DateUtcAndLocal ScheduledRunwayDeparture { get; set; }

    [JsonPropertyName("estimatedRunwayDeparture")]
    public DateUtcAndLocal EstimatedRunwayDeparture { get; set; }

    [JsonPropertyName("actualRunwayDeparture")]
    public DateUtcAndLocal ActualRunwayDeparture { get; set; }

    [JsonPropertyName("scheduledRunwayArrival")]
    public DateUtcAndLocal ScheduledRunwayArrival { get; set; }

    [JsonPropertyName("estimatedRunwayArrival")]
    public DateUtcAndLocal EstimatedRunwayArrival { get; set; }

    [JsonPropertyName("actualRunwayArrival")]
    public DateUtcAndLocal ActualRunwayArrival { get; set; }
}

public class Codeshare
{
    [JsonPropertyName("fsCode")]
    public string FsCode { get; set; }

    [JsonPropertyName("flightNumber")]
    public string FlightNumber { get; set; }

    [JsonPropertyName("relationship")]
    public string Relationship { get; set; }
}

public class Delays
{
    [JsonPropertyName("departureGateDelayMinutes")]
    public int? DepartureGateDelayMinutes { get; set; }

    [JsonPropertyName("departureRunwayDelayMinutes")]
    public int? DepartureRunwayDelayMinutes { get; set; }

    [JsonPropertyName("arrivalGateDelayMinutes")]
    public int? ArrivalGateDelayMinutes { get; set; }

    [JsonPropertyName("arrivalRunwayDelayMinutes")]
    public int? ArrivalRunwayDelayMinutes { get; set; }
}

public class FlightDurations
{
    [JsonPropertyName("scheduledBlockMinutes")]
    public int? ScheduledBlockMinutes { get; set; }

    [JsonPropertyName("blockMinutes")]
    public int? BlockMinutes { get; set; }

    [JsonPropertyName("scheduledAirMinutes")]
    public int? ScheduledAirMinutes { get; set; }

    [JsonPropertyName("airMinutes")]
    public int? AirMinutes { get; set; }

    [JsonPropertyName("scheduledTaxiOutMinutes")]
    public int? ScheduledTaxiOutMinutes { get; set; }

    [JsonPropertyName("taxiOutMinutes")]
    public int? TaxiOutMinutes { get; set; }

    [JsonPropertyName("scheduledTaxiInMinutes")]
    public int? ScheduledTaxiInMinutes { get; set; }

    [JsonPropertyName("taxiInMinutes")]
    public int? TaxiInMinutes { get; set; }
}

public class AirportResources
{
    [JsonPropertyName("departureTerminal")]
    public string DepartureTerminal { get; set; }

    [JsonPropertyName("departureGate")]
    public string DepartureGate { get; set; }

    [JsonPropertyName("arrivalTerminal")]
    public string ArrivalTerminal { get; set; }

    [JsonPropertyName("arrivalGate")]
    public string ArrivalGate { get; set; }

    [JsonPropertyName("baggage")]
    public string Baggage { get; set; }
}

public class FlightEquipment
{
    [JsonPropertyName("scheduledEquipmentIataCode")]
    public string ScheduledEquipmentIataCode { get; set; }

    [JsonPropertyName("actualEquipmentIataCode")]
    public string ActualEquipmentIataCode { get; set; }

    [JsonPropertyName("tailNumber")]
    public string TailNumber { get; set; }
}

public class FlightStatusUpdate
{
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }

    [JsonPropertyName("source")]
    public string Source { get; set; }

    [JsonPropertyName("updatedField")]
    public string UpdatedField { get; set; }

    [JsonPropertyName("newValue")]
    public string NewValue { get; set; }

    [JsonPropertyName("oldValue")]
    public string OldValue { get; set; }
}

public class IrregularOperation
{
    [JsonPropertyName("type")]
    public string Type { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; }

    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; set; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; set; }
}

public class ConfirmedIncident
{
    [JsonPropertyName("message")]
    public string Message { get; set; }

    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; set; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; set; }
}