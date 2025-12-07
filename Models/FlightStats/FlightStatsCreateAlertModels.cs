using System.Text.Json.Serialization;

namespace DespatchWeb.Models.FlightStats;

public class CreateAlertResponse
{
    [JsonPropertyName("request")] public Request Request { get; set; }
    
    [JsonPropertyName("error")] public ApiError Error { get; set; }

    [JsonPropertyName("rule")] public Rule Rule { get; set; }

    [JsonPropertyName("alertCapabilities")] public AlertCapabilities AlertCapabilities { get; set; }

    [JsonPropertyName("appendix")] public Appendix Appendix { get; set; }
}

public class ApiError
{
    [JsonPropertyName("errorId")]
    public string ErrorId { get; set; }
    
    [JsonPropertyName("errorMessage")]
    public string ErrorMessage { get; set; }
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

public class Rule
{
    [JsonPropertyName("id")] public string Id { get; set; }
}

public class RuleEvent
{
    [JsonPropertyName("type")] public string Type { get; set; }

    [JsonPropertyName("value")] public int? Value { get; set; }
}