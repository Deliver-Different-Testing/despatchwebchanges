namespace DespatchWeb.Models.FlightStats;

/// <summary>
/// Helpers for interpreting Cirium/FlightStats IATA <c>serviceType</c> codes that appear on every
/// scheduled flight record. Charter operations (codes C, O, L, H) are returned in the schedule feed
/// just like normal scheduled service - they are not excluded by default - so surfacing this code
/// lets dispatchers tell a regular/seasonal charter apart from scheduled service.
/// </summary>
public static class FlightServiceType
{
    /// <summary>
    /// Charter service-type codes: passenger-only, special handling, passenger+cargo, and cargo/mail.
    /// </summary>
    private static readonly HashSet<string> CharterCodes = ["C", "O", "L", "H"];

    /// <summary>
    /// True when the service-type code represents a charter operation (C, O, L or H).
    /// </summary>
    public static bool IsCharter(string serviceType) =>
        !string.IsNullOrWhiteSpace(serviceType) && CharterCodes.Contains(serviceType.Trim().ToUpperInvariant());

    /// <summary>
    /// Maps a Cirium service-type code to a human-readable description for display.
    /// Returns the raw code when it is unknown, and null when no code is supplied.
    /// </summary>
    public static string Describe(string serviceType)
    {
        if (string.IsNullOrWhiteSpace(serviceType))
        {
            return null;
        }

        return serviceType.Trim().ToUpperInvariant() switch
        {
            "J" => "Scheduled Passenger",
            "S" => "Scheduled Passenger (Shuttle)",
            "U" => "Scheduled Passenger (Service Vehicle)",
            "G" => "Non-scheduled Passenger",
            "B" => "Non-scheduled Passenger (Shuttle)",
            "C" => "Charter (Passenger)",
            "O" => "Charter (Special Handling)",
            "L" => "Charter (Passenger & Cargo)",
            "H" => "Charter (Cargo/Mail)",
            "R" => "Additional Flight (Passenger/Cargo)",
            "Q" => "Scheduled Passenger/Cargo in Cabin",
            "F" => "Scheduled Cargo/Mail",
            "M" => "Scheduled Mail Only",
            "V" => "Scheduled Cargo (Surface Vehicle)",
            "A" => "Non-scheduled Cargo/Mail",
            _ => serviceType.Trim().ToUpperInvariant()
        };
    }
}
