using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class Position
{
    [JsonPropertyName("lat")] public double Lat { get; init; }

    [JsonPropertyName("lng")] public double Lng { get; init; }
}

public class Address
{
    public string Label { get; init; }
    public string CountryCode { get; init; }
    public string CountryName { get; init; }
    public string StateCode { get; init; }
    public string State { get; init; }
    public string County { get; init; }
    public string City { get; init; }
    public string District { get; init; }
    public string Street { get; init; }
    public string PostalCode { get; init; }
    public string HouseNumber { get; init; }
}

public class HereMapsLocationResult
{
    [JsonPropertyName("title")] public string Title { get; init; }

    [JsonPropertyName("id")] public string Id { get; init; }

    [JsonPropertyName("resultType")] public string ResultType { get; init; } = string.Empty;

    [JsonPropertyName("houseNumberType")] public string HouseNumberType { get; init; }

    [JsonPropertyName("address")] public Address Address { get; init; } = new();

    [JsonPropertyName("position")] public Position Position { get; init; }

    [JsonPropertyName("access")] public List<Position> Access { get; init; }
}

public class HereMapsAutocompleteResponse
{
    [JsonPropertyName("items")] public List<HereMapsLocationResult> Items { get; init; }
}

public class HereMapsStreetInfo
{
    public string BaseName { get; init; }
    public string StreetType { get; init; }
    public bool? StreetTypePrecedes { get; init; }
    public bool? StreetTypeAttached { get; init; }
    public string Prefix { get; init; }
    public string Suffix { get; init; }
    public string Direction { get; init; }
    public string Language { get; init; }
}

public class HereMapsLookupResponse
{
    public string Title { get; init; }
    public string Id { get; init; }
    public string Language { get; init; }
    public string ResultType { get; init; }
    public Address Address { get; init; }
    public Position Position { get; init; }
    public List<HereMapsStreetInfo> StreetInfo { get; init; }
}
