namespace DespatchWeb.Models.Response;

public class ApiKeyResponse(string apiKey)
{
    public string ApiKey { get; set; } = apiKey;
}
