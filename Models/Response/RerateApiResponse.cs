namespace DespatchWeb.Models.Response;

public class RerateApiResponse
{
    public ApiRerate ApiRerate { get; set; }
}

public class ApiRerate
{
    public decimal Rate { get; set; }
}