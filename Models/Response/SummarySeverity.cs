using System.Text.Json.Serialization;

namespace DespatchWeb.Models.Response;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SummarySeverity
{
    Ok,
    Info,
    Caution,
    Urgent,
    Critical
}
