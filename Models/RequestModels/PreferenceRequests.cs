namespace DespatchWeb.Models.RequestModels;

/// <summary>The preference names the store will serve. Keep in step with the client's own list.</summary>
public static class PreferenceKeys
{
    /// <summary>Auto-mate: the master switch, the five category toggles, and the rollout notice.</summary>
    public const string AutoMate = "AutoMate";
}

public sealed class SavePreferenceRequest
{
    public string Key { get; init; }
    public string PreferenceJson { get; init; }
}

public sealed class PreferenceResponse
{
    public string Key { get; init; }

    /// <summary>Null when this user has never saved this preference.</summary>
    public string PreferenceJson { get; init; }
}
