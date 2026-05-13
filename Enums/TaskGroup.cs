namespace DespatchWeb.Enums;

public enum TaskGroup
{
    CE,
    SE,
    GE,
    OE,
    CS,
    /// <summary>Partner Tasks — inter-tenant change-request workflow (see tucJobChangeRequest).</summary>
    PT
}