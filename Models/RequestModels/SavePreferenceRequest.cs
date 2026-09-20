namespace DespatchWeb.Models.RequestModels;

public sealed class SavePreferenceRequest
{
    public string PreferenceKey { get; init; }

    public string PreferenceJson { get; init; }
}
