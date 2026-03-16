using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;

public sealed class CreateAlertResponse
{
    [JsonPropertyName("request")] public Request Request { get; init; }
    
    [JsonPropertyName("error")] public ApiError Error { get; init; }

    [JsonPropertyName("rule")] public Rule Rule { get; init; }

    [JsonPropertyName("alertCapabilities")] public AlertCapabilities AlertCapabilities { get; init; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; init; }
}

public sealed class ApiError
{
    [JsonPropertyName("errorId")]
    public string ErrorId { get; init; }
    
    [JsonPropertyName("errorMessage")]
    public string ErrorMessage { get; init; }
}

public sealed class AlertCapabilities
{
    [JsonPropertyName("baggage")] public bool Baggage { get; init; }

    [JsonPropertyName("departureGateChange")] public bool DepartureGateChange { get; init; }

    [JsonPropertyName("arrivalGateChange")] public bool ArrivalGateChange { get; init; }

    [JsonPropertyName("gateDeparture")] public bool GateDeparture { get; init; }

    [JsonPropertyName("gateArrival")] public bool GateArrival { get; init; }

    [JsonPropertyName("runwayDeparture")] public bool RunwayDeparture { get; init; }

    [JsonPropertyName("runwayArrival")] public bool RunwayArrival { get; init; }
}

public sealed class Rule
{
    [JsonPropertyName("id")] public string Id { get; init; }
}

public sealed class RuleEvent
{
    [JsonPropertyName("type")] public string Type { get; init; }

    [JsonPropertyName("value")] public int? Value { get; init; }
}