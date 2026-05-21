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
    IDispatchJobService dispatchJobService,
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

                // Assign the local job to the partner-shaped courier via the same
                // service path the dispatcher UI uses (resets clear-list ordering and
                // cascades to child jobs). IntegrationManager used to mutate
                // UcjbCourierId directly; the assignment now lives here so partner
                // handovers go through DispatchJobService like every other allocation.
                if (result.CourierId.HasValue)
                {
                    try
                    {
                        await dispatchJobService.DispatchJobsToCourierAsync(
                            [request.JobId], result.CourierId.Value);
                    }
                    catch (Exception ex)
                    {
                        // Partner already accepted the job upstream; surface the local
                        // assignment failure to the caller without unwinding the partner
                        // handover (which we can't roll back).
                        Log.Error(ex,
                            "Partner accepted job {JobId} but local courier assignment to {CourierId} failed",
                            request.JobId, result.CourierId.Value);
                        return new SendToPartnerResponse
                        {
                            Success = false,
                            TrackingNumber = result.TrackingNumber,
                            CourierId = result.CourierId,
                            Message =
                                $"Partner accepted the job but assigning the local courier failed: {ex.Message}"
                        };
                    }
                }
                else
                {
                    Log.Warning(
                        "Job {JobId}: IntegrationManager returned no CourierId — pairing has no courier configured, local assignment skipped",
                        request.JobId);
                }

                await RecordPartnerDispatchJourneyAsync(request.JobId, result.TrackingNumber, result.CourierId);
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

    /// <summary>
    /// Audit-only: records "this job was handed off to a partner" on JobDeliveryJourney so the
    /// dispatcher's journey timeline shows the partner dispatch alongside courier assignments,
    /// status changes, etc. Best-effort — partner already accepted upstream by this point, so a
    /// journey write failure must not unwind the success path.
    /// </summary>
    private async Task RecordPartnerDispatchJourneyAsync(int jobId, string trackingNumber, int? newCourierId)
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
                NewCourierId = newCourierId,
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

    // Includes a snippet of the raw response body so the actual cause (e.g. "Invalid request -
    // missing required header" from a CSRF middleware, or an HTML error page from a proxy)
    // surfaces in the UI instead of being hidden behind a generic "400 BadRequest".
    private static string BuildFallbackErrorMessage(HttpStatusCode statusCode, string body)
    {
        var prefix = $"Integration Manager returned {(int)statusCode} {statusCode}";
        if (string.IsNullOrWhiteSpace(body))
            return prefix;

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
        httpRequest.Headers.Add("Authorization", $"Bearer {bearerToken}");
        httpRequest.Headers.Add("X-Requested-With", "XMLHttpRequest");
        httpRequest.Headers.Add("X-IM-Authorization", $"Bearer {bearerToken}");

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
