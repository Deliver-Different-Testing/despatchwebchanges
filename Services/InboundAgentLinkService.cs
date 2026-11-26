#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed class InboundAgentLinkService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService tenantInfo,
    ITenantClock clock) : IInboundAgentLinkService
{
    private const int LinkLifetimeDays = 14;

    public async Task<string?> MintJobLinkAsync(DespatchContext context, int jobId, int agentId,
        CancellationToken cancellationToken = default)
    {
        var baseUrl = await GetBaseUrlAsync(context, cancellationToken);
        if (baseUrl is null)
        {
            return null;
        }

        var jobDate = await context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => (DateTime?)j.UcjbDate)
            .FirstOrDefaultAsync(cancellationToken);

        var nowUtc = clock.UtcNow;
        var expiresUtc = jobDate is { } date && date != default
            ? TimeZoneHelper.TenantLocalToUtc(date, tenantInfo.GetTenantTimeZone()).AddDays(LinkLifetimeDays)
            : nowUtc.AddDays(LinkLifetimeDays);

        await RevokeJobTokensAsync(context, jobId, cancellationToken);

        var (token, hash) = AgentLinkToken.Create();
        context.AgentAssignmentTokens.Add(new AgentAssignmentToken
        {
            TokenHash = hash,
            JobId = jobId,
            AgentId = agentId,
            CreatedUtc = nowUtc,
            ExpiresUtc = expiresUtc
        });

        return $"{baseUrl}/{AgentLinkToken.Prefix}{token}";
    }

    public async Task<string?> BuildPreviewLinkAsync(int jobId, CancellationToken cancellationToken = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(cancellationToken);
        var baseUrl = await GetBaseUrlAsync(ctx, cancellationToken);
        return baseUrl is null ? null : $"{baseUrl}/{AgentLinkToken.PreviewPlaceholder}";
    }

    public async Task RevokeJobTokensAsync(DespatchContext context, int jobId,
        CancellationToken cancellationToken = default)
    {
        var nowUtc = clock.UtcNow;
        await context.AgentAssignmentTokens
            .Where(t => t.JobId == jobId && t.RevokedUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedUtc, nowUtc), cancellationToken);
    }

    private static async Task<string?> GetBaseUrlAsync(DespatchContext context, CancellationToken cancellationToken)
    {
        var baseUrl = await context.TblSettings
            .Select(s => s.InboundUrl)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.TrimEnd('/');
    }
}
