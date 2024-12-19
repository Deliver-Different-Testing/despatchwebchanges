namespace DespatchWeb.Models.Config;

public class GoogleMapsConfig
{
    public ApiKeyConfig ApiKey { get; set; }
}

public class ApiKeyConfig
{
    public string Production { get; set; }
    public string Development { get; set; }
}