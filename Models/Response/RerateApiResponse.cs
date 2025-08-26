namespace DespatchWeb.Models.Response;

public class RerateApiResponse
{
    public ApiRerate ApiRerate { get; set; }
    public ApiErrors ApiErrors { get; set; }
}

public class ApiErrors
{
    public string AdditionalProp1 { get; set; }
    public string AdditionalProp2 { get; set; }
    public string AdditionalProp3 { get; set; }
}

public class ApiRerate
{
    public string Description { get; set; }
    public decimal Rate { get; set; }
}