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
    public string Street { get; init; }
    public string HouseNumber { get; init; }
}

public class HereMapsLocationResult
{
    [JsonPropertyName("resultType")] public string ResultType { get; init; } = string.Empty;
    
    [JsonPropertyName("address")] public Address Address { get; init; } = new();
}

public class HereMapsAutocompleteResponse
{
    [JsonPropertyName("items")] public List<HereMapsLocationResult> Items { get; init; }
}

public class HereMapsLookupResponse
{
    public string Title { get; init; }
    public string Id { get; init; }
    public string Language { get; init; }
    public string ResultType { get; init; }
    public Address Address { get; init; }
    public Position Position { get; init; }
}