#nullable enable
using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.AutoMate;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Services.AutoMate;

/// <summary>
/// Exchanges the pod's projected service-account token for a CSP access token (RFC 8693). In Development,
/// where there is no cluster, a client secret stands in. Failures return null and never reach the chat.
/// </summary>
public sealed class CspTokenProvider(
    IHttpClientFactory httpClientFactory,
    IOptions<ServiceAuthOptions> authOptions,
    IHostEnvironment environment,
    TimeProvider timeProvider) : IServiceTokenProvider
{
    public const string HttpClientName = nameof(CspTokenProvider);

    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan HalfLifeThreshold = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan WarningInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(5);

    private readonly ConcurrentDictionary<string, SemaphoreSlim> _gates = new();
    private readonly ConcurrentDictionary<string, CachedToken> _cache = new();
    private long _lastWarningTicks = long.MinValue;

    public bool IsConfigured(string? baseUrl) =>
        !string.IsNullOrWhiteSpace(baseUrl) && (DevSecretUsable || File.Exists(authOptions.Value.AssertionPath));

    private bool DevSecretUsable =>
        environment.IsDevelopment() && !string.IsNullOrWhiteSpace(authOptions.Value.ClientSecret);

    public async Task<string?> GetTokenAsync(string baseUrl, string? profile, CancellationToken ct)
    {
        var key = Key(baseUrl, profile);
        if (TryGetCached(key, out var cached))
        {
            return cached;
        }

        var gate = _gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (TryGetCached(key, out cached))
            {
                return cached;
            }

            var fetched = await RequestAsync(baseUrl, profile, ct);
            if (fetched is null)
            {
                return null;
            }

            _cache[key] = fetched;
            return fetched.Value;
        }
        finally
        {
            gate.Release();
        }
    }

    public void Invalidate(string baseUrl, string? profile) => _cache.TryRemove(Key(baseUrl, profile), out _);

    private static string Key(string baseUrl, string? profile) => $"{baseUrl.TrimEnd('/')}|{profile}";

    private bool TryGetCached(string key, out string? token)
    {
        if (_cache.TryGetValue(key, out var entry) && timeProvider.GetUtcNow() < entry.RefreshAt)
        {
            token = entry.Value;
            return true;
        }

        token = null;
        return false;
    }

    private async Task<CachedToken?> RequestAsync(string baseUrl, string? profile, CancellationToken ct)
    {
        try
        {
            using var request = BuildRequest($"{baseUrl.TrimEnd('/')}/api/v1/knowledge/token", profile);
            if (request is null)
            {
                return null;
            }

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(RequestTimeout);

            // A client per exchange: this provider is a singleton (it holds the cache), so a captured client would
            // never pick up the factory's handler rotation.
            var httpClient = httpClientFactory.CreateClient(HttpClientName);
            using var response = await httpClient.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                Warn($"CSP token endpoint returned {(int)response.StatusCode}");
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<TokenResponse>(timeout.Token);
            if (body is null || string.IsNullOrWhiteSpace(body.AccessToken) || body.ExpiresIn <= 0)
            {
                Warn("CSP token response was missing access_token or expires_in");
                return null;
            }

            if (!string.Equals(body.TokenType, "Bearer", StringComparison.OrdinalIgnoreCase))
            {
                Warn("CSP token response token_type was not Bearer");
                return null;
            }

            var lifetime = TimeSpan.FromSeconds(body.ExpiresIn);
            var refreshIn = lifetime > HalfLifeThreshold ? lifetime - RefreshMargin : lifetime / 2;
            return new CachedToken(body.AccessToken, timeProvider.GetUtcNow() + refreshIn);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            Warn($"CSP token request failed ({ex.GetType().Name})");
            return null;
        }
    }

    private HttpRequestMessage? BuildRequest(string url, string? profile)
    {
        var options = authOptions.Value;
        var fields = new List<KeyValuePair<string, string>>();

        if (DevSecretUsable)
        {
            fields.Add(new("grant_type", "client_credentials"));
            fields.Add(new("client_id", options.ClientId));
            fields.Add(new("client_secret", options.ClientSecret!));
        }
        else
        {
            // Re-read on every exchange: the kubelet rotates the projected token.
            string assertion;
            try
            {
                assertion = File.ReadAllText(options.AssertionPath).Trim();
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Warn($"Service account token file could not be read ({ex.GetType().Name})");
                return null;
            }

            if (assertion.Length == 0)
            {
                Warn("Service account token file is empty");
                return null;
            }

            fields.Add(new("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange"));
            fields.Add(new("subject_token", assertion));
            fields.Add(new("subject_token_type", "urn:ietf:params:oauth:token-type:jwt"));
            fields.Add(new("audience", "csp"));
        }

        if (profile is not null)
        {
            fields.Add(new("scope", $"profile:{profile}"));
        }

        return new HttpRequestMessage(HttpMethod.Post, url) { Content = new FormUrlEncodedContent(fields) };
    }

    private void Warn(string message)
    {
        var now = timeProvider.GetUtcNow().UtcTicks;
        var last = Interlocked.Read(ref _lastWarningTicks);
        if (last != long.MinValue && now - last < WarningInterval.Ticks)
        {
            return;
        }

        if (Interlocked.CompareExchange(ref _lastWarningTicks, now, last) == last)
        {
            Log.Warning("CSP service token unavailable: {Reason}", message);
        }
    }

    private sealed record CachedToken(string Value, DateTimeOffset RefreshAt);

    private sealed class TokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("token_type")]
        public string? TokenType { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }
}
