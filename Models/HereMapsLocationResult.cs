using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public sealed class HereMapsLocationResult
{
    [JsonPropertyName("title")] public string Title { get; init; }

    [JsonPropertyName("id")] public string Id { get; init; }

    [JsonPropertyName("resultType")] public string ResultType { get; init; } = string.Empty;

    [JsonPropertyName("houseNumberType")] public string HouseNumberType { get; init; }

    [JsonPropertyName("address")] public Address Address { get; init; } = new();

    [JsonPropertyName("position")] public Position Position { get; init; }

    [JsonPropertyName("access")] public List<Position> Access { get; init; }
}
