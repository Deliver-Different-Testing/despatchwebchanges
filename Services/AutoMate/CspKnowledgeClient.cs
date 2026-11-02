#nullable enable
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services.AutoMate;

/// <summary>
/// Reads CSP's knowledge base for the current user's audience. Every failure is reported as
/// <see cref="CspKbStatus.Unavailable"/> rather than thrown, so the chat can tell "no article" from "couldn't check".
/// </summary>
public sealed class CspKnowledgeClient(
    HttpClient httpClient,
    CspBaseUrlResolver baseUrlResolver,
    AutoMateAudience audience,
    IServiceTokenProvider tokenProvider,
    CspKnowledgeCircuits circuits) : ICspKnowledgeClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly Lazy<string?> _baseUrl = new(baseUrlResolver.Resolve);
    private readonly CspKnowledgeCircuit circuit = circuits.For(audience.CspProfile);

    public bool IsConfigured => tokenProvider.IsConfigured(_baseUrl.Value);

    public async Task<CspKbSearchResult> SearchAsync(string query, int limit, TimeSpan timeout, CancellationToken ct)
    {
        if (!IsConfigured || circuit.IsOpen)
        {
            return CspKbSearchResult.Unavailable;
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return new CspKbSearchResult(CspKbStatus.Ok, []);
        }

        var path = $"api/v1/knowledge/search?q={Uri.EscapeDataString(query)}&limit={limit}";
        var call = await GetAsync<List<CspKbHit>>(path, timeout, ct);

        return call.Outcome == Outcome.Ok
            ? new CspKbSearchResult(CspKbStatus.Ok, call.Body ?? [])
            : CspKbSearchResult.Unavailable;
    }

    public async Task<CspKbArticleResult> GetArticleAsync(Guid id, TimeSpan timeout, CancellationToken ct)
    {
        if (!IsConfigured || circuit.IsOpen)
        {
            return CspKbArticleResult.Unavailable;
        }

        var call = await GetAsync<CspKbArticle>($"api/v1/knowledge/articles/{id}", timeout, ct, notFoundIsAbsence: true);

        return call.Outcome switch
        {
            Outcome.Ok when call.Body is not null => new CspKbArticleResult(CspKbStatus.Ok, call.Body),
            Outcome.NotFound => new CspKbArticleResult(CspKbStatus.NotFound, null),
            _ => CspKbArticleResult.Unavailable
        };
    }

    private async Task<(Outcome Outcome, T? Body)> GetAsync<T>(
        string path, TimeSpan timeout, CancellationToken ct, bool notFoundIsAbsence = false) where T : class
    {
        var endpoint = path.Split('?')[0];
        var baseUrl = _baseUrl.Value!;
        var profile = audience.CspProfile;

        // Our budget is swallowed below; the caller's own cancellation still propagates.
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(timeout);

        try
        {
            var url = $"{baseUrl}/{path}";

            var token = await tokenProvider.GetTokenAsync(baseUrl, profile, budget.Token);
            if (token is null)
            {
                circuit.RecordFailure($"{endpoint} no service token", permanent: false);
                return (Outcome.Failed, null);
            }

            var response = await SendAsync(url, token, budget.Token);
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                response.Dispose();
                tokenProvider.Invalidate(baseUrl, profile);
                token = await tokenProvider.GetTokenAsync(baseUrl, profile, budget.Token);
                if (token is null)
                {
                    circuit.RecordFailure($"{endpoint} no service token", permanent: false);
                    return (Outcome.Failed, null);
                }

                response = await SendAsync(url, token, budget.Token);
            }

            using var _ = response;

            if (response.StatusCode == HttpStatusCode.NotFound && notFoundIsAbsence)
            {
                return (Outcome.NotFound, null);
            }

            if (!response.IsSuccessStatusCode)
            {
                var permanent = response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden;
                circuit.RecordFailure($"{endpoint} returned {(int)response.StatusCode}", permanent);
                return (Outcome.Failed, null);
            }

            var body = await response.Content.ReadFromJsonAsync<T>(JsonOptions, budget.Token);
            circuit.RecordSuccess();
            return (Outcome.Ok, body);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            circuit.RecordFailure($"{endpoint} {ex.GetType().Name}", permanent: false);
            return (Outcome.Failed, null);
        }
    }

    private async Task<HttpResponseMessage> SendAsync(string url, string token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await httpClient.SendAsync(request, ct);
    }

    private enum Outcome
    {
        Ok,
        NotFound,
        Failed
    }
}
