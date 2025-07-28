using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class Position
{
    [JsonPropertyName("lat")] public double Lat { get; set; }

    [JsonPropertyName("lng")] public double Lng { get; set; }
}

public class MapView
{
    [JsonPropertyName("west")] public double West { get; set; }

    [JsonPropertyName("south")] public double South { get; set; }

    [JsonPropertyName("east")] public double East { get; set; }

    [JsonPropertyName("north")] public double North { get; set; }
}

public class FieldScore
{
    [JsonPropertyName("streets")] public double[]? Streets { get; set; }

    [JsonPropertyName("houseNumber")] public double? HouseNumber { get; set; }

    [JsonPropertyName("placeName")] public double? PlaceName { get; set; }
}

public class Scoring
{
    [JsonPropertyName("queryScore")] public double QueryScore { get; set; }

    [JsonPropertyName("fieldScore")] public FieldScore? FieldScore { get; set; }
}

public class Address
{
    [JsonPropertyName("label")] public string Label { get; set; } = string.Empty;

    [JsonPropertyName("countryCode")] public string CountryCode { get; set; } = string.Empty;

    [JsonPropertyName("countryName")] public string CountryName { get; set; } = string.Empty;

    [JsonPropertyName("stateCode")] public string StateCode { get; set; } = string.Empty;

    [JsonPropertyName("state")] public string State { get; set; } = string.Empty;

    [JsonPropertyName("county")] public string County { get; set; } = string.Empty;

    [JsonPropertyName("city")] public string City { get; set; } = string.Empty;

    [JsonPropertyName("district")] public string District { get; set; } = string.Empty;

    [JsonPropertyName("street")] public string Street { get; set; } = string.Empty;

    [JsonPropertyName("postalCode")] public string PostalCode { get; set; } = string.Empty;

    [JsonPropertyName("houseNumber")] public string HouseNumber { get; set; } = string.Empty;
}

public class Category
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;

    [JsonPropertyName("primary")] public bool? Primary { get; set; }
}

public class FoodType
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;

    [JsonPropertyName("primary")] public bool? Primary { get; set; }
}

public class HereMapsLocationResult
{
    [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;

    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;

    [JsonPropertyName("resultType")] public string ResultType { get; set; } = string.Empty;

    [JsonPropertyName("houseNumberType")] public string? HouseNumberType { get; set; }

    [JsonPropertyName("address")] public Address Address { get; set; } = new();

    [JsonPropertyName("position")] public Position Position { get; set; } = new();

    [JsonPropertyName("access")] public List<Position> Access { get; set; } = new();

    [JsonPropertyName("mapView")] public MapView MapView { get; set; } = new();

    [JsonPropertyName("estimatedPointAddress")]
    public bool? EstimatedPointAddress { get; set; }

    [JsonPropertyName("scoring")] public Scoring Scoring { get; set; } = new();

    [JsonPropertyName("categories")] public List<Category>? Categories { get; set; }

    [JsonPropertyName("foodTypes")] public List<FoodType>? FoodTypes { get; set; }
}

public class HereMapsAutocompleteResponse
{
    [JsonPropertyName("items")] public List<HereMapsLocationResult>? Items { get; set; }
}

public class HereMapsLookupResponse
{
    [JsonPropertyName("id")] public string? Id { get; set; }

    [JsonPropertyName("resultType")] public string? ResultType { get; set; }

    [JsonPropertyName("address")] public Address? Address { get; set; }

    [JsonPropertyName("position")] public Position? Position { get; set; }

    [JsonPropertyName("countryInfo")] public HereMapsCountryInfo? CountryInfo { get; set; }

    [JsonPropertyName("streetInfo")] public List<HereMapsStreetInfo>? StreetInfo { get; set; }
}

public class HereMapsCountryInfo
{
    [JsonPropertyName("alpha2")] public string? Alpha2 { get; set; }

    [JsonPropertyName("alpha3")] public string? Alpha3 { get; set; }
}

public class HereMapsStreetInfo
{
    [JsonPropertyName("baseName")] public string? BaseName { get; set; }

    [JsonPropertyName("streetType")] public string? StreetType { get; set; }
}