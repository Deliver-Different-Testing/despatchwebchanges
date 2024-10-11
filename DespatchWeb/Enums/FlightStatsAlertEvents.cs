using System;
using System.Runtime.Serialization;

namespace DespatchWeb.Enums;

public enum FlightStatsAlertEvents
{
    [EnumMember(Value = "preDep")] PreDepartureStatus,

    [EnumMember(Value = "preArr")] PreArrivalStatus,

    [EnumMember(Value = "any")] EnRoute,

    [EnumMember(Value = "any")] Landed,

    [EnumMember(Value = "any")] Cancelled,

    [EnumMember(Value = "any")] Diverted,

    [EnumMember(Value = "any")] DepartureDelay,

    [EnumMember(Value = "any")] ArrivalDelay,

    [EnumMember(Value = "any")] Baggage,

    [EnumMember(Value = "any")] TimeAdjustment,

    [EnumMember(Value = "any")] DepartureGate,

    [EnumMember(Value = "any")] ArrivalGate,

    [EnumMember(Value = "any")] EquipmentAdjustment,

    [EnumMember(Value = "unknown")] Unknown
}

public static class WebhookEventTypeExtensions
{
    public static string GetStringValue(this FlightStatsAlertEvents eventType)
    {
        var memberInfo = typeof(FlightStatsAlertEvents).GetMember(eventType.ToString());
        var enumMemberAttribute =
            (EnumMemberAttribute)Attribute.GetCustomAttribute(memberInfo[0], typeof(EnumMemberAttribute));
        return enumMemberAttribute?.Value ?? eventType.ToString();
    }

    public static FlightStatsAlertEvents ParseWebhookEventType(string value)
    {
        foreach (FlightStatsAlertEvents eventType in Enum.GetValues(typeof(FlightStatsAlertEvents)))
        {
            if (eventType.GetStringValue() == value)
            {
                return eventType;
            }
        }

        throw new ArgumentException($"Invalid WebhookEventType value: {value}", nameof(value));
    }
}
