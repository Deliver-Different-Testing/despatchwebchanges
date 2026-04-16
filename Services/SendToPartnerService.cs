using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
        var baseUrl = ResolveBaseUrl();
        if (string.IsNullOrEmpty(baseUrl))
        {
            Log.Error("Unable to determine Integration Manager URL");
            return new SendToPartnerResponse
            {
                Success = false,
                Message = "Integration Manager is not configured"
            };
        }

        var url = $"{baseUrl.TrimEnd('/')}/api/v1/admin/partner/dispatch";

        var user = contextAccessor.HttpContext?.User;
        var connectionString = user?.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = user?.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var clientId = user?.Claims.FirstOrDefault(x => x.Type == "ClientID")?.Value;
        var timeZone = user?.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = user?.FindFirst(ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId) ||
            string.IsNullOrEmpty(timeZone) || string.IsNullOrEmpty(userName))
        {
            Log.Error("Missing required user claims for SendToPartner JWT token");
            return new SendToPartnerResponse
            {
                Success = false,
                Message = "Unable to authenticate with Integration Manager"
            };
        }

        var token = AuthenticationExtensions.CreateApiToken(userName,
            int.Parse(tenantId),
            connectionString,
            timeZone,
            string.IsNullOrEmpty(clientId) ? null : int.Parse(clientId));
        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new { jobId = request.JobId, partnerId = request.PartnerId })
        };
        httpRequest.Headers.Add("Authorization", $"Bearer {requestToken}");

        var response = await httpClient.SendAsync(httpRequest);
        var result = await response.Content.ReadFromJsonAsync<SendToPartnerResponse>();

        if (result is { Success: true })
        {
            Log.Information("Job {JobId} sent to partner, tracking: {TrackingNumber}",
                request.JobId, result.TrackingNumber);
        }
        else
        {
            Log.Warning("Failed to send job {JobId} to partner: {Message}",
                request.JobId, result?.Message);
        }

        return result ?? new SendToPartnerResponse
        {
            Success = false,
            Message = "No response from Integration Manager"
        };
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
