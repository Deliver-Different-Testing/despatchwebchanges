#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Gets CSP access tokens by exchanging the pod's Kubernetes service-account token. A token is
/// cached per CSP address and per registration profile (null = the app's base registration).
/// </summary>
public interface IServiceTokenProvider
{
    bool IsConfigured(string? baseUrl);

    Task<string?> GetTokenAsync(string baseUrl, string? profile, CancellationToken ct);

    void Invalidate(string baseUrl, string? profile);
}
