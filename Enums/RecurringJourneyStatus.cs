using System.Text.Json.Serialization;

namespace DespatchWeb.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RecurringJourneyStatus
{
    Pending,
    InProgress,
    Completed,
    Voided
}