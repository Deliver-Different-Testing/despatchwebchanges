#nullable enable
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed class InboundAgentLinkService(IDbContextFactory<DespatchContext> contextFactory)
    : IInboundAgentLinkService
{
    public async Task<string?> BuildJobLinkAsync(int jobId, CancellationToken cancellationToken = default)
    {
        await using var ctx = await contextFactory.CreateDbContextAsync(cancellationToken);

        var baseUrl = await ctx.TblSettings
            .Select(s => s.InboundUrl)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return null;
        }

        var token = await ctx.TblSettings
            .Select(_ => DespatchContext.EncryptJobIdReversible(jobId))
            .FirstOrDefaultAsync(cancellationToken);

        return string.IsNullOrWhiteSpace(token) ? null : $"{baseUrl.TrimEnd('/')}/{token}";
    }
}