namespace DespatchWeb.Models.Response;

public sealed record ApiKeyResponse(string apiKey)
{
    public string ApiKey { get; init; } = apiKey;
}
