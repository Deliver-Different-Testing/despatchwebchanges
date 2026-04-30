using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

public sealed class SendToPartnerService(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IWebHostEnvironment environment) : ISendToPartnerService
{
    public async Task<SendToPartnerResponse> SendAsync(SendToPartnerRequest request)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (baseUrl is null || bearerToken is null)
        {
            return new SendToPartnerResponse
            {
                Success = false,
                Message = baseUrl is null
                    ? "Integration Manager is not configured"
                    : "Unable to authenticate with Integration Manager"
            };
        }

        var url = $"{baseUrl}/api/v1/admin/partner/dispatch";

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new
            {
                jobId = request.JobId,
                pairingId = request.PartnerId,
                agreedRate = request.AgreedRate
            })
        };
        httpRequest.Headers.Add("Authorization", $"Bearer {bearerToken}");

        try
        {
            var response = await httpClient.SendAsync(httpRequest);
            var body = await response.Content.ReadAsStringAsync();

            var result = TryDeserialize(body);

            if (!response.IsSuccessStatusCode)
            {
                Log.Warning("Failed to send job {JobId} to partner: {StatusCode} {Body}",
                    request.JobId, response.StatusCode, body);
                return result ?? new SendToPartnerResponse
                {
                    Success = false,
                    Message = $"Integration Manager returned {(int)response.StatusCode} {response.StatusCode}"
                };
            }

            if (result is null)
            {
                Log.Error("Invalid response body from Integration Manager for job {JobId}: {Body}",
                    request.JobId, body);
                return new SendToPartnerResponse
                {
                    Success = false,
                    Message = "Invalid response from Integration Manager"
                };
            }

            if (result.Success)
            {
                Log.Information("Job {JobId} sent to partner, tracking: {TrackingNumber}",
                    request.JobId, result.TrackingNumber);
            }
            else
            {
                Log.Warning("Failed to send job {JobId} to partner: {Message}",
                    request.JobId, result.Message);
            }

            return result;
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "Could not reach Integration Manager when sending job {JobId} to partner", request.JobId);
            return new SendToPartnerResponse
            {
                Success = false,
                Message = "Could not reach Integration Manager"
            };
        }
        catch (TaskCanceledException ex)
        {
            Log.Error(ex, "Integration Manager request timed out when sending job {JobId} to partner", request.JobId);
            return new SendToPartnerResponse
            {
                Success = false,
                Message = "Integration Manager request timed out"
            };
        }
    }

    private static SendToPartnerResponse TryDeserialize(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;

        try
        {
            return JsonSerializer.Deserialize<SendToPartnerResponse>(body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task<PartnerRateForJobResponse> GetRateForJobAsync(int pairingId, int jobId)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (baseUrl is null || bearerToken is null)
        {
            return new PartnerRateForJobResponse { Source = "none" };
        }

        var url = $"{baseUrl}/api/v1/admin/partner/pairings/{pairingId}/rate-for-job";

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new { jobId })
        };
        httpRequest.Headers.Add("Authorization", $"Bearer {bearerToken}");

        try
        {
            var response = await httpClient.SendAsync(httpRequest);
            if (response.IsSuccessStatusCode)
                return await response.Content.ReadFromJsonAsync<PartnerRateForJobResponse>()
                       ?? new PartnerRateForJobResponse { Source = "none" };
           
            Log.Warning("Rate lookup failed for pairing {PairingId}, job {JobId}: {StatusCode}",
                pairingId, jobId, response.StatusCode);
            return new PartnerRateForJobResponse { Source = "none" };

        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error fetching rate for pairing {PairingId}, job {JobId}", pairingId, jobId);
            return new PartnerRateForJobResponse { Source = "none" };
        }
    }

    private (string BaseUrl, string BearerToken) ResolveUrlAndToken()
    {
        var baseUrl = ResolveBaseUrl();
        if (string.IsNullOrEmpty(baseUrl))
        {
            Log.Error("Unable to determine Integration Manager URL");
            return (null, null);
        }

        var user = contextAccessor.HttpContext?.User;
        var connectionString = user?.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = user?.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var clientId = user?.Claims.FirstOrDefault(x => x.Type == "ClientID")?.Value;
        var timeZone = user?.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = user?.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId) ||
            string.IsNullOrEmpty(timeZone) || string.IsNullOrEmpty(userName))
        {
            Log.Error("Missing required user claims for Integration Manager JWT token");
            return (baseUrl.TrimEnd('/'), null);
        }

        var token = AuthenticationExtensions.CreateApiToken(userName,
            int.Parse(tenantId),
            connectionString,
            timeZone,
            string.IsNullOrEmpty(clientId) ? null : int.Parse(clientId));
        var bearerToken = new JwtSecurityTokenHandler().WriteToken(token);

        return (baseUrl.TrimEnd('/'), bearerToken);
    }

    private string ResolveBaseUrl()
    {
        if (environment.IsDevelopment())
            return Environment.GetEnvironmentVariable("IntegrationManagerUrl");

        var httpContext = contextAccessor.HttpContext;
        if (httpContext is null)
            return null;

        var req = httpContext.Request;
        var host = req.Host.Value?.Replace("despatch", "integrationmanager", StringComparison.OrdinalIgnoreCase);
        return $"{req.Scheme}://{host}";
    }
}
