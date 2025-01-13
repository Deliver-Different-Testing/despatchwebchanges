using System;
using System.Collections.Generic;
using System.Linq;

namespace DespatchWeb.Helpers;

public static class AddressFormatter
{
    /// <summary>
    /// Formats address lines into a single string, handling null/empty lines.
    /// Combines city, state, and zip on one line when possible.
    /// </summary>
    public static string Format(Address address)
    {
        if (address == null)
            return string.Empty;

        var lines = new[]
        {
            address.Line1,
            address.Line2,
            address.Line3,
            address.Line4,
            address.Line5,
            address.Line6,
            address.Line7,
            address.Line8
        };

        var validLines = lines
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => line.Trim())
            .ToList();

        // If no valid lines, return empty string
        return !validLines.Any() ? string.Empty : string.Join(", ", validLines);
    }

    /// <summary>
    /// Formats address lines into a multi-line string with proper line breaks
    /// </summary>
    public static string FormatMultiLine(Address address)
    {
        if (address == null)
            return string.Empty;

        var lines = new[]
        {
            address.Line1,
            address.Line2,
            address.Line3,
            address.Line4,
            address.Line5,
            address.Line6,
            address.Line7,
            address.Line8
        };

        var validLines = lines
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => line.Trim())
            .ToList();

        // If no valid lines, return empty string
        return !validLines.Any() ? string.Empty : string.Join(Environment.NewLine, validLines);
    }

    /// <summary>
    /// Formats address with HTML line breaks for web display
    /// </summary>
    public static string FormatHtml(Address address)
    {
        if (address == null)
            return string.Empty;

        var lines = new[]
        {
            address.Line1,
            address.Line2,
            address.Line3,
            address.Line4,
            address.Line5,
            address.Line6,
            address.Line7,
            address.Line8
        };

        var validLines = lines
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => line.Trim())
            .ToList();

        // If no valid lines, return empty string
        return !validLines.Any() ? string.Empty : string.Join("<br/>", validLines);
    }

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

    public class Address
    {
        public Address(
            string line1 = null,
            string line2 = null,
            string line3 = null,
            string line4 = null,
            string line5 = null,
            string line6 = null,
            string line7 = null,
            string line8 = null)
        {
            Line1 = line1;
            Line2 = line2;
            Line3 = line3;
            Line4 = line4;
            Line5 = line5;
            Line6 = line6;
            Line7 = line7;
            Line8 = line8;
        }

        public string Line1 { get; set; }
        public string Line2 { get; set; }
        public string Line3 { get; set; }
        public string Line4 { get; set; }
        public string Line5 { get; set; }
        public string Line6 { get; set; }
        public string Line7 { get; set; }
        public string Line8 { get; set; }
    }
}
