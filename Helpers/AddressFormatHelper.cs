using System.Collections.Generic;

namespace DespatchWeb.Helpers;

public static class AddressFormatter
{
    /// <summary>
    /// Attempts to format the last line as a city, state zip combination
    /// </summary>
    public static string FormatWithCityStateZip(Address address)
    {
        if (address == null)
            return string.Empty;

        var lines = new List<string>();

        // Add non-empty lines except the last three (potential city, state, zip)
        for (var i = 0; i < 5; i++)
        {
            var line = GetAddressLine(address, i);
            if (!string.IsNullOrWhiteSpace(line))
            {
                lines.Add(line.Trim());
            }
        }

        // Try to combine city, state, zip
        var city = GetAddressLine(address, 5)?.Trim();
        var state = GetAddressLine(address, 6)?.Trim();
        var zip = GetAddressLine(address, 7)?.Trim();

        if (string.IsNullOrWhiteSpace(city)) return string.Join(", ", lines);
        var lastLine = city;
        if (!string.IsNullOrWhiteSpace(state))
        {
            lastLine += ", " + state;
            if (!string.IsNullOrWhiteSpace(zip))
            {
                lastLine += " " + zip;
            }
        }

        lines.Add(lastLine);

        return string.Join(", ", lines);
    }

    private static string GetAddressLine(Address address, int index)
    {
        return index switch
        {
            0 => address.Line1,
            1 => address.Line2,
            2 => address.Line3,
            3 => address.Line4,
            4 => address.Line5,
            5 => address.Line6,
            6 => address.Line7,
            7 => address.Line8,
            _ => null
        };
    }

    public class Address(
        string line1 = null,
        string line2 = null,
        string line3 = null,
        string line4 = null,
        string line5 = null,
        string line6 = null,
        string line7 = null,
        string line8 = null)
    {
        public string Line1 { get; } = line1;
        public string Line2 { get; } = line2;
        public string Line3 { get; } = line3;
        public string Line4 { get; } = line4;
        public string Line5 { get; } = line5;
        public string Line6 { get; } = line6;
        public string Line7 { get; } = line7;
        public string Line8 { get; } = line8;
    }
}
