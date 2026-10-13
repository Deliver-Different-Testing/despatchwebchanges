#nullable enable annotations
namespace DespatchWeb.Models.Response;

public sealed record RerateApiResponse
{
    public ApiRerate? Rerate { get; init; } 
    public Errors Errors { get; init; }
}
