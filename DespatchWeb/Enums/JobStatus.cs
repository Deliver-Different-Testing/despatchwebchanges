using System.Runtime.Serialization;

namespace DespatchWeb.Enums;

public enum JobStatus
{
    [EnumMember(Value = "D")] New = 0,

    [EnumMember(Value = "D")] Despatched = 1,

    [EnumMember(Value = "A")] Accepted = 2,

    [EnumMember(Value = "R")] Rejected = 3,

    [EnumMember(Value = "LP")] LatePickup = 4,

    [EnumMember(Value = "P")] PickedUp = 5,

    [EnumMember(Value = "C")] Completed = 6,

    [EnumMember(Value = "W")] Warning = 7,

    [EnumMember(Value = "LD")] LateDelivery = 8,

    [EnumMember(Value = "AW")] AwaitingPod = 9,

    [EnumMember(Value = "UD")] Undeliverable = 10,

    [EnumMember(Value = "IT")] InTransit = 11,

    [EnumMember(Value = "AC")] Acknowledge = 12,

    [EnumMember(Value = "ASC")] AssumingCompleted = 13,

    [EnumMember(Value = "RFP")] ReadyForPacking = 14,

    [EnumMember(Value = "RTP")] ReadyToPickup = 15,

    [EnumMember(Value = "D")] AwaitingProcessing = 16,

    [EnumMember(Value = "OFD")] OutForDelivery = 17,

    [EnumMember(Value = "PA")] Preassigned = 18
}