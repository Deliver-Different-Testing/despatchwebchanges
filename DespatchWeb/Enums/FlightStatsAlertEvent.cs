using System.Runtime.Serialization;

namespace DespatchWeb.Enums;

public enum FlightStatsAlertEvent
{
    [EnumMember(Value = "PRE_DEPARTURE_STATUS")]
    PreDepartureStatus,

    [EnumMember(Value = "PRE_ARRIVAL_STATUS")]
    PreArrivalStatus,

    [EnumMember(Value = "EN_ROUTE")] EnRoute,

    [EnumMember(Value = "LANDED")] Landed,

    [EnumMember(Value = "CANCELLED")] Cancelled,

    [EnumMember(Value = "DIVERTED")] Diverted,

    [EnumMember(Value = "DEPARTURE_DELAY")]
    DepartureDelay,

    [EnumMember(Value = "ARRIVAL_DELAY")] ArrivalDelay,

    [EnumMember(Value = "BAGGAGE")] Baggage,

    [EnumMember(Value = "TIME_ADJUSTMENT")]
    TimeAdjustment,

    [EnumMember(Value = "DEPARTURE_GATE")] DepartureGate,

    [EnumMember(Value = "ARRIVAL_GATE")] ArrivalGate,

    [EnumMember(Value = "EQUIPMENT_ADJUSTMENT\t")]
    EquipmentAdjustment,

    [EnumMember(Value = "UNKNOWN")] Unknown
}
