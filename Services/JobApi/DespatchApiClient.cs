using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using Serilog;

namespace DespatchWeb.Services.JobApi;

/// <summary>
/// HTTP client to the Despatch api project. Mirrors
/// IntegrationManager.Core.Http.DespatchApiClient so DespatchWeb and IM make
/// the same calls in the same way (auth, JSON casing, error envelope).
/// </summary>
public sealed class DespatchApiClient(
    HttpClient httpClient,
    IDespatchApiBaseUrlResolver baseUrlResolver) : IDespatchApiClient
{
    private const string TokenName = "DespatchWeb";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<JobResponseDto> BookPickupAsync(int tenantId, string connection, string timeZone,
        int? clientId, int contactId, BookPickupDto request, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Post, "api/Jobs",
            tenantId, connection, timeZone, clientId, contactId, request, ct);

        var body = await response.Content.ReadAsStringAsync(ct);

        if (response.IsSuccessStatusCode)
            return JsonSerializer.Deserialize<JobResponseDto>(body, JsonOptions)
                   ?? new JobResponseDto { Error = new ErrorDto { Message = "Empty response from api" } };

        Log.Error("api BookPickup failed: {StatusCode} {Body}", response.StatusCode, body);
        return new JobResponseDto { Error = new ErrorDto { Message = body } };
    }

    private async Task<HttpResponseMessage> SendAsync<T>(HttpMethod method, string path,
        int tenantId, string connection, string timeZone, int? clientId, int contactId, T body, CancellationToken ct)
    {
        var token = AuthenticationExtensions.CreateApiToken(
            name: TokenName,
            tenantId: tenantId,
            connection: connection,
            timeZone: timeZone,
            clientId: clientId,
            contactId: contactId);

        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

        var request = new HttpRequestMessage(method, new Uri(baseUrlResolver.Resolve(), path));
        request.Headers.Add("Authorization", $"Bearer {requestToken}");

        if (body is not null) request.Content = JsonContent.Create(body);

        return await httpClient.SendAsync(request, ct);
    }
}
