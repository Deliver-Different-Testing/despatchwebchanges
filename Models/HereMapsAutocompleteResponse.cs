using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public sealed class HereMapsAutocompleteResponse
{
    [JsonPropertyName("items")] public List<HereMapsLocationResult> Items { get; init; }
}
