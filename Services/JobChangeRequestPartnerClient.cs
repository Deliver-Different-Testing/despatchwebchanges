#nullable enable
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// DespatchWeb → Integration Manager client for the job-change-request workflow.
/// SC-JWT minting and base-URL resolution mirror <see cref="SendToPartnerService"/>;
/// any deviation in claim handling or proxy-fallback headers would break the same way
/// the dispatch flow can, so we keep the two implementations parallel.
/// </summary>
public sealed class JobChangeRequestPartnerClient(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IWebHostEnvironment environment) : IJobChangeRequestPartnerClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Task<PartnerForwardResult> ForwardCreateAsync(int pairingId, Guid partnerJobGuid, Guid sourceRequestUuid,
        string fieldName, string? currentValue, string? requestedValue, string? reason, string approvalMode,
        bool requiresCommercialRefresh, CancellationToken ct) =>
        PostAsync("/api/v1/admin/partner/job-change-requests", new
        {
            pairingId,
            partnerJobGuid,
            sourceRequestUuid,
            fieldName,
            currentValue,
            requestedValue,
            reason,
            approvalMode,
            requiresCommercialRefresh,
            // PartnerTenantId on the inter-IM wire = the originator's tenant id, pulled
            // from the same JWT claim ResolveUrlAndToken() uses for auth. The peer IM
            // re-stamps this from its signature filter at receive — this is a hint for
            // the originating IM's audit log, not the authoritative value.
            partnerTenantId = ResolveCurrentTenantId()
        }, ct);

    private string? ResolveCurrentTenantId() =>
        contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;

    public Task<PartnerForwardResult> ForwardDecisionAsync(int pairingId, Guid sourceRequestUuid, string outcome,
        string? reason, CancellationToken ct) =>
        PostAsync($"/api/v1/admin/partner/job-change-requests/{sourceRequestUuid}/decision", new
        {
            pairingId,
            outcome,
            reason
        }, ct);

    public Task<PartnerForwardResult> ForwardAppliedAsync(int pairingId, Guid sourceRequestUuid,
        decimal? newCommercialAmount, CancellationToken ct) =>
        PostAsync($"/api/v1/admin/partner/job-change-requests/{sourceRequestUuid}/applied", new
        {
            pairingId,
            newCommercialAmount
        }, ct);

    private async Task<PartnerForwardResult> PostAsync<T>(string path, T body, CancellationToken ct)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (baseUrl is null || bearerToken is null)
        {
            return new PartnerForwardResult
            {
                Success = false,
                Message = baseUrl is null
                    ? "Integration Manager is not configured"
                    : "Unable to authenticate with Integration Manager"
            };
        }

        var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}{path}")
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.Add("Authorization", $"Bearer {bearerToken}");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");

        try
        {
            var response = await httpClient.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                return new PartnerForwardResult { Success = true };
            }

            var body2 = await response.Content.ReadAsStringAsync(ct);
            Log.Warning("IM admin call {Path} failed: {StatusCode} {Body}", path, response.StatusCode, body2);
            return new PartnerForwardResult
            {
                Success = false,
                Message = $"Integration Manager returned {(int)response.StatusCode}"
            };
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "Could not reach Integration Manager for {Path}", path);
            return new PartnerForwardResult { Success = false, Message = "Could not reach Integration Manager" };
        }
        catch (TaskCanceledException ex)
        {
            Log.Error(ex, "Integration Manager call timed out for {Path}", path);
            return new PartnerForwardResult { Success = false, Message = "Integration Manager request timed out" };
        }
    }

    private (string? BaseUrl, string? BearerToken) ResolveUrlAndToken() =>
        IntegrationManagerAuth.ResolveUrlAndToken(contextAccessor, environment, nameof(JobChangeRequestPartnerClient));
}
