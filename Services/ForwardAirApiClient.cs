using System.Net.Http.Json;
#nullable enable
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using Serilog;

namespace DespatchWeb.Services;

public sealed class ForwardAirApiClient(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IWebHostEnvironment environment,
    TimeSpan? quoteTimeout = null) : IForwardAirApiClient
{
    public static readonly TimeSpan DefaultQuoteTimeout = TimeSpan.FromSeconds(4);

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly TimeSpan _quoteTimeout = quoteTimeout ?? DefaultQuoteTimeout;

    public async Task<ForwardAirQuoteResponseDto> GetLegQuoteAsync(int legId, ForwardAirLegQuoteRequestDto? search,
        CancellationToken ct = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(_quoteTimeout);

        try
        {
            using var response = await SendAsync(HttpMethod.Post, $"/api/v1/forwardair/quotes/leg/{legId}", timeout.Token,
                search is null ? null : JsonContent.Create(search, options: JsonOptions));
            var body = await response.Content.ReadAsStringAsync(timeout.Token);

            if (!response.IsSuccessStatusCode)
            {
                Log.Warning("IM Forward Air leg quote failed: {StatusCode} {Body}", response.StatusCode, body);
                return Failure($"Forward Air quote failed ({(int)response.StatusCode}).");
            }

            return JsonSerializer.Deserialize<ForwardAirQuoteResponseDto>(body, JsonOptions)
                   ?? Failure("Forward Air returned an empty quote.");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            Log.Warning("IM Forward Air leg quote for {LegId} exceeded {Timeout}", legId, _quoteTimeout);
            return Failure("Forward Air did not respond in time.");
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException)
        {
            Log.Warning(ex, "IM Forward Air leg quote for {LegId} failed", legId);
            return Failure("Forward Air quote is unavailable.");
        }
    }

    public async Task<ForwardAirJobDto?> GetJobAsync(int legId, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Get, $"/api/v1/forwardair/jobs/{legId}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            Log.Error("IM Forward Air job lookup failed: {StatusCode}", response.StatusCode);
            throw new HttpRequestException($"Integration Manager Forward Air job error: {response.StatusCode}");
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<ForwardAirJobDto>(body, JsonOptions);
    }

    public async Task<ForwardAirDocument?> GetDocumentAsync(int legId, string type, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Get,
            $"/api/v1/forwardair/jobs/{legId}/documents/{Uri.EscapeDataString(type)}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            Log.Error("IM Forward Air document {Type} failed: {StatusCode}", type, response.StatusCode);
            throw new HttpRequestException($"Integration Manager Forward Air document error: {response.StatusCode}");
        }

        var buffer = new MemoryStream();
        await response.Content.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        return new ForwardAirDocument(
            buffer,
            response.Content.Headers.ContentType?.MediaType ?? "application/pdf",
            response.Content.Headers.ContentDisposition?.FileNameStar ??
            response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
    }

    private static ForwardAirQuoteResponseDto Failure(string error) => new() {Success = false, Error = error};

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, CancellationToken ct,
        HttpContent? content = null)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(bearerToken))
        {
            throw new InvalidOperationException(
                baseUrl is null
                    ? "Integration Manager URL is not configured."
                    : "Unable to authenticate with Integration Manager.");
        }

        using var request = new HttpRequestMessage(method, $"{baseUrl}{path}") {Content = content};
        request.Headers.Add("Authorization", $"Bearer {bearerToken}");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");

        return await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    private (string? BaseUrl, string? BearerToken) ResolveUrlAndToken() =>
        IntegrationManagerAuth.ResolveUrlAndToken(contextAccessor, environment, nameof(ForwardAirApiClient));
}
