namespace DespatchWeb.Models.Response;

public class Errors;

public class ApiRerate
{
    public decimal Rate { get; init; }
}

public class RerateApiResponse
{
    public ApiRerate Rerate { get; init; } 
    public Errors Errors { get; init; }
}