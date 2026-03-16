namespace DespatchWeb.Models.Response;

public sealed record Errors;

public sealed record ApiRerate
{
    public decimal Rate { get; init; }
}

public sealed record RerateApiResponse
{
    public ApiRerate Rerate { get; init; } 
    public Errors Errors { get; init; }
}