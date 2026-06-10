namespace DespatchWeb.Enums;

// Three-state operational mode for a recurring tucJobBooking row.
// Backed by the tucJobBooking.RecurringMode column (tinyint, default 1).
// Ordinals are persisted — do not renumber.
public enum RecurringMode : byte
{
    Inactive = 0,
    Active = 1,
    Manual = 2
}
