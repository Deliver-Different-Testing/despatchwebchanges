using Newtonsoft.Json;

namespace DespatchWeb.Models.Response;

public sealed record Errors;

public sealed record ApiRerate
{
    [JsonProperty("rate")]
    public decimal Rate { get; init; }
    [JsonProperty("description")]
    public string? Description { get; init; }
}

public sealed record RerateApiResponse
{
    public ApiRerate Rerate { get; init; } 
    public Errors Errors { get; init; }
}