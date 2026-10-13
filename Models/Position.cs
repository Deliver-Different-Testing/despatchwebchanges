using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public sealed class Position
{
    [JsonPropertyName("lat")] public double Lat { get; init; }

    [JsonPropertyName("lng")] public double Lng { get; init; }
}
