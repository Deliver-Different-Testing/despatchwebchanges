using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;


public class FlightStatusResponse
{
    [JsonPropertyName("request")]
    public InterpretedRequest Request { get; init; }

    [JsonPropertyName("error")]
    public ApiResponseError Error { get; init; }

    [JsonPropertyName("appendix")]
    public AppendixWithWrapper Appendix { get; init; }

    [JsonPropertyName("flightStatus")]
    public FlightStatus FlightStatus { get; init; }

    [JsonPropertyName("flightStatuses")]
    public List<FlightStatus> FlightStatuses { get; init; }

    [JsonPropertyName("schema")]
    public string Schema { get; init; }
}

public class InterpretedRequest
{
    [JsonPropertyName("carrier")]
    public string Carrier { get; init; }

    [JsonPropertyName("flight")]
    public string Flight { get; init; }

    [JsonPropertyName("year")]
    public int Year { get; init; }

    [JsonPropertyName("month")]
    public int Month { get; init; }

    [JsonPropertyName("day")]
    public int Day { get; init; }

    [JsonPropertyName("utc")]
    public bool Utc { get; init; }

    [JsonPropertyName("airport")]
    public string Airport { get; init; }

    [JsonPropertyName("codeType")]
    public string CodeType { get; init; }

    [JsonPropertyName("extendedOptions")]
    public List<string> ExtendedOptions { get; init; }

    [JsonPropertyName("url")]
    public string Url { get; init; }
}

public class ApiResponseError
{
    [JsonPropertyName("errorId")]
    public string ErrorId { get; init; }

    [JsonPropertyName("errorCode")]
    public string ErrorCode { get; init; }

    [JsonPropertyName("errorMessage")]
    public string ErrorMessage { get; init; }

    [JsonPropertyName("httpStatusCode")]
    public int HttpStatusCode { get; init; }
}

public class AppendixWithWrapper
{
    [JsonPropertyName("airlines")]
    public List<Airline> Airlines { get; init; }

    [JsonPropertyName("airports")]
    public List<Airport> Airports { get; init; }

    [JsonPropertyName("equipments")]
    public List<Equipment> Equipments { get; init; }
}

public class FlightStatus
{
    [JsonPropertyName("flightId")]
    public long FlightId { get; init; }

    [JsonPropertyName("carrier")]
    public Airline Carrier { get; init; }

    [JsonPropertyName("carrierFsCode")]
    public string CarrierFsCode { get; init; }

    [JsonPropertyName("operatingCarrier")]
    public Airline OperatingCarrier { get; init; }

    [JsonPropertyName("operatingCarrierFsCode")]
    public string OperatingCarrierFsCode { get; init; }

    [JsonPropertyName("primaryCarrier")]
    public Airline PrimaryCarrier { get; init; }

    [JsonPropertyName("primaryCarrierFsCode")]
    public string PrimaryCarrierFsCode { get; init; }

    [JsonPropertyName("flightNumber")]
    public string FlightNumber { get; init; }

    [JsonPropertyName("departureAirport")]
    public Airport DepartureAirport { get; init; }

    [JsonPropertyName("departureAirportFsCode")]
    public string DepartureAirportFsCode { get; init; }

    [JsonPropertyName("arrivalAirport")]
    public Airport ArrivalAirport { get; init; }

    [JsonPropertyName("arrivalAirportFsCode")]
    public string ArrivalAirportFsCode { get; init; }

    [JsonPropertyName("divertedAirport")]
    public Airport DivertedAirport { get; init; }

    [JsonPropertyName("divertedAirportFsCode")]
    public string DivertedAirportFsCode { get; init; }

    [JsonPropertyName("departureDate")]
    public DateUtcAndLocal DepartureDate { get; init; }

    [JsonPropertyName("arrivalDate")]
    public DateUtcAndLocal ArrivalDate { get; init; }

    [JsonPropertyName("status")]
    public string Status { get; init; }

    [JsonPropertyName("schedule")]
    public Schedule Schedule { get; init; }

    [JsonPropertyName("operationalTimes")]
    public OperationalTimes OperationalTimes { get; init; }

    [JsonPropertyName("codeshares")]
    public List<Codeshare> Codeshares { get; init; }

    [JsonPropertyName("delays")]
    public Delays Delays { get; init; }

    [JsonPropertyName("flightDurations")]
    public FlightDurations FlightDurations { get; init; }

    [JsonPropertyName("airportResources")]
    public AirportResources AirportResources { get; init; }

    [JsonPropertyName("flightEquipment")]
    public FlightEquipment FlightEquipment { get; init; }

    [JsonPropertyName("flightStatusUpdates")]
    public List<FlightStatusUpdate> FlightStatusUpdates { get; init; }

    [JsonPropertyName("irregularOperations")]
    public List<IrregularOperation> IrregularOperations { get; init; }

    [JsonPropertyName("confirmedIncident")]
    public ConfirmedIncident ConfirmedIncident { get; init; }

    [JsonPropertyName("lastDataAcquiredDate")]
    public DateTime? LastDataAcquiredDate { get; init; }
}

public class DateUtcAndLocal
{
    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; init; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; init; }
}

public class Schedule
{
    [JsonPropertyName("flightType")]
    public string FlightType { get; init; }

    [JsonPropertyName("serviceClasses")]
    public List<string> ServiceClasses { get; init; }

    [JsonPropertyName("restrictions")]
    public List<string> Restrictions { get; init; }
}

public class OperationalTimes
{
    [JsonPropertyName("publishedDeparture")]
    public DateUtcAndLocal PublishedDeparture { get; init; }

    [JsonPropertyName("publishedArrival")]
    public DateUtcAndLocal PublishedArrival { get; init; }

    [JsonPropertyName("scheduledGateDeparture")]
    public DateUtcAndLocal ScheduledGateDeparture { get; init; }

    [JsonPropertyName("estimatedGateDeparture")]
    public DateUtcAndLocal EstimatedGateDeparture { get; init; }

    [JsonPropertyName("actualGateDeparture")]
    public DateUtcAndLocal ActualGateDeparture { get; init; }

    [JsonPropertyName("scheduledGateArrival")]
    public DateUtcAndLocal ScheduledGateArrival { get; init; }

    [JsonPropertyName("estimatedGateArrival")]
    public DateUtcAndLocal EstimatedGateArrival { get; init; }

    [JsonPropertyName("actualGateArrival")]
    public DateUtcAndLocal ActualGateArrival { get; init; }

    [JsonPropertyName("scheduledRunwayDeparture")]
    public DateUtcAndLocal ScheduledRunwayDeparture { get; init; }

    [JsonPropertyName("estimatedRunwayDeparture")]
    public DateUtcAndLocal EstimatedRunwayDeparture { get; init; }

    [JsonPropertyName("actualRunwayDeparture")]
    public DateUtcAndLocal ActualRunwayDeparture { get; init; }

    [JsonPropertyName("scheduledRunwayArrival")]
    public DateUtcAndLocal ScheduledRunwayArrival { get; init; }

    [JsonPropertyName("estimatedRunwayArrival")]
    public DateUtcAndLocal EstimatedRunwayArrival { get; init; }

    [JsonPropertyName("actualRunwayArrival")]
    public DateUtcAndLocal ActualRunwayArrival { get; init; }
}

public class Codeshare
{
    [JsonPropertyName("fsCode")]
    public string FsCode { get; init; }

    [JsonPropertyName("flightNumber")]
    public string FlightNumber { get; init; }

    [JsonPropertyName("relationship")]
    public string Relationship { get; init; }
}

public class Delays
{
    [JsonPropertyName("departureGateDelayMinutes")]
    public int? DepartureGateDelayMinutes { get; init; }

    [JsonPropertyName("departureRunwayDelayMinutes")]
    public int? DepartureRunwayDelayMinutes { get; init; }

    [JsonPropertyName("arrivalGateDelayMinutes")]
    public int? ArrivalGateDelayMinutes { get; init; }

    [JsonPropertyName("arrivalRunwayDelayMinutes")]
    public int? ArrivalRunwayDelayMinutes { get; init; }
}

public class FlightDurations
{
    [JsonPropertyName("scheduledBlockMinutes")]
    public int? ScheduledBlockMinutes { get; init; }

    [JsonPropertyName("blockMinutes")]
    public int? BlockMinutes { get; init; }

    [JsonPropertyName("scheduledAirMinutes")]
    public int? ScheduledAirMinutes { get; init; }

    [JsonPropertyName("airMinutes")]
    public int? AirMinutes { get; init; }

    [JsonPropertyName("scheduledTaxiOutMinutes")]
    public int? ScheduledTaxiOutMinutes { get; init; }

    [JsonPropertyName("taxiOutMinutes")]
    public int? TaxiOutMinutes { get; init; }

    [JsonPropertyName("scheduledTaxiInMinutes")]
    public int? ScheduledTaxiInMinutes { get; init; }

    [JsonPropertyName("taxiInMinutes")]
    public int? TaxiInMinutes { get; init; }
}

public class AirportResources
{
    [JsonPropertyName("departureTerminal")]
    public string DepartureTerminal { get; init; }

    [JsonPropertyName("departureGate")]
    public string DepartureGate { get; init; }

    [JsonPropertyName("arrivalTerminal")]
    public string ArrivalTerminal { get; init; }

    [JsonPropertyName("arrivalGate")]
    public string ArrivalGate { get; init; }

    [JsonPropertyName("baggage")]
    public string Baggage { get; init; }
}

public class FlightEquipment
{
    [JsonPropertyName("scheduledEquipmentIataCode")]
    public string ScheduledEquipmentIataCode { get; init; }

    [JsonPropertyName("actualEquipmentIataCode")]
    public string ActualEquipmentIataCode { get; init; }

    [JsonPropertyName("tailNumber")]
    public string TailNumber { get; init; }
}

public class FlightStatusUpdate
{
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; init; }

    [JsonPropertyName("source")]
    public string Source { get; init; }

    [JsonPropertyName("updatedField")]
    public string UpdatedField { get; init; }

    [JsonPropertyName("newValue")]
    public string NewValue { get; init; }

    [JsonPropertyName("oldValue")]
    public string OldValue { get; init; }
}

public class IrregularOperation
{
    [JsonPropertyName("type")]
    public string Type { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; }

    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; init; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; init; }
}

public class ConfirmedIncident
{
    [JsonPropertyName("message")]
    public string Message { get; init; }

    [JsonPropertyName("dateUtc")]
    public DateTime? DateUtc { get; init; }

    [JsonPropertyName("dateLocal")]
    public DateTime? DateLocal { get; init; }
}