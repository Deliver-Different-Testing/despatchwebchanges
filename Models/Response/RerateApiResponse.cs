namespace DespatchWeb.Models.Response;

public class Errors
{
}

public class ApiRerate
{
    public string Description { get; set; }
    public decimal Rate { get; set; }
}

public class RerateApiResponse
{
    public ApiRerate Rerate { get; set; } 
    public Errors Errors { get; set; }
}