#nullable enable
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// HTTP client to the Integration Manager Cirium gateway. SC-JWT minting and base-URL resolution
/// mirror <see cref="JobChangeRequestPartnerClient"/> so DespatchWeb authenticates to IM the same way.
/// </summary>
public sealed class CiriumApiClient(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IWebHostEnvironment environment) : ICiriumApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<CiriumFlightSearchResponseDto> SearchFlightsAsync(
        CiriumFlightSearchRequestDto request, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, "/api/v1/admin/cirium/flight-search", request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (response.IsSuccessStatusCode)
        {
            return JsonSerializer.Deserialize<CiriumFlightSearchResponseDto>(body, JsonOptions)
                   ?? new CiriumFlightSearchResponseDto { Message = "Empty response from Integration Manager." };
        }

        // IM returns 400 with a populated Message for validation problems (e.g. unknown airport).
        // Surface it as ArgumentException so the controller's existing catch shows the message,
        // mirroring the legacy direct-Cirium behaviour.
        if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            var dto = JsonSerializer.Deserialize<CiriumFlightSearchResponseDto>(body, JsonOptions);
            throw new ArgumentException(dto?.Message ?? "Invalid flight search request.");
        }

        Log.Error("IM Cirium flight-search failed: {StatusCode} {Body}", response.StatusCode, body);
        throw new HttpRequestException($"Integration Manager Cirium flight-search error: {response.StatusCode}");
    }

    public async Task<string?> CreateAlertAsync(CiriumCreateAlertRequestDto request, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, "/api/v1/admin/cirium/alerts", request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (response.IsSuccessStatusCode)
        {
            return JsonSerializer.Deserialize<CiriumAlertResultDto>(body, JsonOptions)?.RuleId;
        }

        Log.Error("IM Cirium create-alert failed: {StatusCode} {Body}", response.StatusCode, body);
        throw new HttpRequestException($"Integration Manager Cirium create-alert error: {response.StatusCode}");

    }

    public async Task DeleteAlertAsync(string ruleId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(ruleId))
        {
            return;
        }

        using var response = await SendAsync<object>(HttpMethod.Delete, $"/api/v1/admin/cirium/alerts/{ruleId}", body: null, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            Log.Error("IM Cirium delete-alert failed: {StatusCode} {Body}", response.StatusCode, body);
            throw new HttpRequestException($"Integration Manager Cirium delete-alert error: {response.StatusCode}");
        }
    }

    public async Task<bool> IsAlertActiveAsync(string ruleId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(ruleId))
        {
            return false;
        }

        try
        {
            using var response = await SendAsync<object>(HttpMethod.Get, $"/api/v1/admin/cirium/alerts/{ruleId}", body: null, ct);
            if (!response.IsSuccessStatusCode)
            {
                Log.Warning("IM Cirium alert status {RuleId} returned {StatusCode}", ruleId, response.StatusCode);
                return false;
            }

            var body = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<CiriumAlertStatusDto>(body, JsonOptions)?.Active ?? false;
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "IM Cirium alert status check failed for {RuleId}", ruleId);
            return false;
        }
    }

    private async Task<HttpResponseMessage> SendAsync<T>(HttpMethod method, string path, T? body, CancellationToken ct)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(bearerToken))
        {
            throw new InvalidOperationException(
                baseUrl is null
                    ? "Integration Manager URL is not configured."
                    : "Unable to authenticate with Integration Manager.");
        }

        var request = new HttpRequestMessage(method, $"{baseUrl}{path}");
        request.Headers.Add("Authorization", $"Bearer {bearerToken}");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");

        if (body is not null)
        {
            request.Content = JsonContent.Create(body, options: JsonOptions);
        }

        return await httpClient.SendAsync(request, ct);
    }

    private (string? BaseUrl, string? BearerToken) ResolveUrlAndToken() =>
        IntegrationManagerAuth.ResolveUrlAndToken(contextAccessor, environment, nameof(CiriumApiClient));
}
