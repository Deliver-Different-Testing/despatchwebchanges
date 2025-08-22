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
    public string Label { get; set; }
    public string CountryCode { get; set; }
    public string CountryName { get; set; }
    public string StateCode { get; set; }
    public string State { get; set; }
    public string County { get; set; }
    public string City { get; set; }
    public string Street { get; set; }
    public string PostalCode { get; set; }
    public string HouseNumber { get; set; }
    public string District { get; set; }
}

public class Category
{
    public string Id { get; set; }
    public string Name { get; set; }
    public bool Primary { get; set; }
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
    public string Title { get; set; }
    public string Id { get; set; }
    public string Language { get; set; }
    public string ResultType { get; set; }
    public Address Address { get; set; }
    public Position Position { get; set; }
    public List<HereMapsAccess> Access { get; set; }
    public List<Category> Categories { get; set; }
    public List<HereMapsContact> Contacts { get; set; }
    public List<HereMapsStreetInfo> StreetInfo { get; set; }
    public HereMapsCountryInfo CountryInfo { get; set; }
}

public class HereMapsContact
{
    public List<HereMapsContactPhone> Phone { get; set; }
    public List<HereMapsContactWebsite> Www { get; set; }
}

public class HereMapsContactPhone
{
    public string Value { get; set; }
}

public class HereMapsContactWebsite
{
    public string Value { get; set; }
}

public class HereMapsAccess
{
    public double Lat { get; set; }
    public double Lng { get; set; }
}

public class HereMapsCountryInfo
{
    [JsonPropertyName("alpha2")] public string? Alpha2 { get; set; }

    [JsonPropertyName("alpha3")] public string? Alpha3 { get; set; }
}

public class HereMapsStreetInfo
{
    public string BaseName { get; set; }
    public string StreetType { get; set; }
    public bool StreetTypePrecedes { get; set; }
    public bool StreetTypeAttached { get; set; }
    public string Prefix { get; set; }
    public string Language { get; set; }
}