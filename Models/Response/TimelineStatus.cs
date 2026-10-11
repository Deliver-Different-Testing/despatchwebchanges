using System.Text.Json.Serialization;

namespace DespatchWeb.Models.Response;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TimelineStatus
{
    Ok,
    Pending,
    Warning,
    Late
}
