#nullable enable
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

public sealed class SendToPartnerService(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    IWebHostEnvironment environment,
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfoService) : ISendToPartnerService
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
        // Sent in addition to Authorization so that an upstream proxy stripping the Bearer token
        // doesn't trip Integration Manager's CSRF middleware — without this the rejection looks
        // like a missing-header bug rather than the auth failure it actually is.
        httpRequest.Headers.Add("X-Requested-With", "XMLHttpRequest");
        // Fallback transport for the JWT. The IM staging ingress strips the standard
        // Authorization header before it reaches the upstream pod (proven via diagnostic
        // logging — AuthorizationHeader=absent on every despatchweb→IM call). Until the
        // ingress is fixed to forward Authorization, IM's JWT bearer auth also accepts the
        // token from this header. Same JWT, same validation; only the transport differs.
        httpRequest.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");

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
                    Message = BuildFallbackErrorMessage(response.StatusCode, body)
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

                await RecordOutboundPartnerDispatchAsync(request.JobId, request.PartnerId);
                await RecordPartnerDispatchJourneyAsync(request.JobId, result.TrackingNumber ?? string.Empty);
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

    // Persists the outbound job→pairing link so the dispatch UI can surface the partner
    // name in the courier column. Idempotent: re-sending an already-linked job updates the
    // pairing reference instead of failing on the PK.
    private async Task RecordOutboundPartnerDispatchAsync(int jobId, int pairingId)
    {
        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            var existing = await ctx.JobPartnerDispatches.FindAsync(jobId);
            if (existing is null)
            {
                ctx.JobPartnerDispatches.Add(new JobPartnerDispatch
                {
                    JobId = jobId,
                    PartnerPairingId = pairingId
                });
            }
            else
            {
                existing.PartnerPairingId = pairingId;
            }

            await ctx.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Partner already accepted upstream — log and continue so the success path
            // isn't unwound by a local persistence hiccup.
            Log.Error(ex,
                "Job {JobId}: failed to persist JobPartnerDispatch link to pairing {PairingId}",
                jobId, pairingId);
        }
    }

    /// <summary>
    /// Audit-only: records "this job was handed off to a partner" on JobDeliveryJourney so the
    /// dispatcher's journey timeline shows the partner dispatch alongside courier assignments,
    /// status changes, etc. Best-effort — partner already accepted upstream by this point, so a
    /// journey write failure must not unwind the success path.
    /// </summary>
    private async Task RecordPartnerDispatchJourneyAsync(int jobId, string trackingNumber)
    {
        try
        {
            await using var ctx = await contextFactory.CreateDbContextAsync();
            ctx.JobDeliveryJourneys.Add(new JobDeliveryJourney
            {
                JobId = jobId,
                ChangeType = nameof(DeliveryJourneyChangeType.JobUpdate),
                FieldName = "partnerJobGuid",
                NewValue = trackingNumber,
                StaffId = ResolveStaffIdOrNull(),
                UpdatedAt = DateTime.UtcNow,
                UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff),
                Comments = string.IsNullOrWhiteSpace(trackingNumber)
                    ? "Job sent to partner"
                    : $"Job sent to partner; tracking {trackingNumber}"
            });
            await ctx.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Log.Warning(ex,
                "Job {JobId}: failed to record partner-dispatch journey entry (audit-only, ignored)", jobId);
        }
    }

    // ITenantInfoService.GetStaffId throws when there's no HTTP user context (background calls,
    // tests without a mocked tenant). Audit columns prefer "we don't know" (null) over a misleading
    // staff #0, so swallow and return null.
    private int? ResolveStaffIdOrNull()
    {
        try
        {
            var id = tenantInfoService.GetStaffId();
            return id > 0 ? id : null;
        }
        catch
        {
            return null;
        }
    }

    private static SendToPartnerResponse? TryDeserialize(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

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

    // Includes a snippet of the raw response body so the actual cause (e.g. "Invalid request -
    // missing required header" from a CSRF middleware, or an HTML error page from a proxy)
    // surfaces in the UI instead of being hidden behind a generic "400 BadRequest".
    private static string BuildFallbackErrorMessage(HttpStatusCode statusCode, string body)
    {
        var prefix = $"Integration Manager returned {(int)statusCode} {statusCode}";
        if (string.IsNullOrWhiteSpace(body))
        {
            return prefix;
        }

        var snippet = body.Length > 200 ? body[..200] + "…" : body;
        return $"{prefix}: {snippet.Trim()}";
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
        AttachBearer(httpRequest, bearerToken);

        try
        {
            var response = await httpClient.SendAsync(httpRequest);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<PartnerRateForJobResponse>()
                       ?? new PartnerRateForJobResponse { Source = "none" };
            }

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

    public async Task<PartnerInboundJobAcceptanceStateResponse?> GetInboundJobAcceptanceStateAsync(int jobId)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (baseUrl is null || bearerToken is null)
        {
            return null;
        }

        var url = $"{baseUrl}/api/v1/admin/partner/inbound-jobs/by-job/{jobId}";
        var httpRequest = new HttpRequestMessage(HttpMethod.Get, url);
        AttachBearer(httpRequest, bearerToken);

        try
        {
            var response = await httpClient.SendAsync(httpRequest);
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                Log.Warning("Acceptance-state lookup failed for job {JobId}: {StatusCode}",
                    jobId, response.StatusCode);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<PartnerInboundJobAcceptanceStateResponse>();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error fetching acceptance state for job {JobId}", jobId);
            return null;
        }
    }

    public Task<PartnerInboundJobActionResponse> AcceptInboundJobAsync(int jobId) =>
        PostInboundJobActionAsync(jobId, "accept", payload: null);

    public Task<PartnerInboundJobActionResponse> RejectInboundJobAsync(int jobId, string reason) =>
        PostInboundJobActionAsync(jobId, "reject", payload: new { reason });

    private async Task<PartnerInboundJobActionResponse> PostInboundJobActionAsync(int jobId, string action,
        object? payload)
    {
        var (baseUrl, bearerToken) = ResolveUrlAndToken();
        if (baseUrl is null || bearerToken is null)
        {
            return new PartnerInboundJobActionResponse
            {
                Success = false,
                ErrorMessage = baseUrl is null
                    ? "Integration Manager is not configured"
                    : "Unable to authenticate with Integration Manager"
            };
        }

        var url = $"{baseUrl}/api/v1/admin/partner/inbound-jobs/by-job/{jobId}/{action}";
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        if (payload is not null)
        {
            httpRequest.Content = JsonContent.Create(payload);
        }

        AttachBearer(httpRequest, bearerToken);

        try
        {
            var response = await httpClient.SendAsync(httpRequest);
            var body = await response.Content.ReadAsStringAsync();
            var result = TryDeserializeAction(body);

            if (!response.IsSuccessStatusCode)
            {
                Log.Warning("Acceptance {Action} failed for job {JobId}: {StatusCode} {Body}",
                    action, jobId, response.StatusCode, body);
                return result ?? new PartnerInboundJobActionResponse
                {
                    Success = false,
                    ErrorMessage = BuildFallbackErrorMessage(response.StatusCode, body)
                };
            }

            return result ?? new PartnerInboundJobActionResponse { Success = true };
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error posting acceptance {Action} for job {JobId}", action, jobId);
            return new PartnerInboundJobActionResponse { Success = false, ErrorMessage = ex.Message };
        }
    }

    private static void AttachBearer(HttpRequestMessage request, string bearerToken)
    {
        request.Headers.Add("Authorization", $"Bearer {bearerToken}");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        request.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");
    }

    private static PartnerInboundJobActionResponse? TryDeserializeAction(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<PartnerInboundJobActionResponse>(body,
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private (string? BaseUrl, string? BearerToken) ResolveUrlAndToken()
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

    private string? ResolveBaseUrl()
    {
        if (environment.IsDevelopment())
        {
            return Environment.GetEnvironmentVariable("IntegrationManagerUrl");
        }

        var httpContext = contextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var req = httpContext.Request;
        var host = req.Host.Value?.Replace("despatch", "integrationmanager", StringComparison.OrdinalIgnoreCase);
        return $"{req.Scheme}://{host}";
    }
}
