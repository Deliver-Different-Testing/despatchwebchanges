#nullable enable annotations
using Newtonsoft.Json;

namespace DespatchWeb.Models.Response;

public sealed record ApiRerate
{
    [JsonProperty("rate")]
    public decimal Rate { get; init; }
    [JsonProperty("description")]
    public string? Description { get; init; }
}
