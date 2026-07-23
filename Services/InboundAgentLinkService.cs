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

        // Canonical token: reuse the same reversible-encryption UDF the automation engine
        // and UTL_fncJob_PlaceholderData use, so the link matches the rest of the system.
        var token = await ctx.Database
            .SqlQueryRaw<string?>("SELECT dbo.EncryptJobIdReversible({0}) AS Value", jobId)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        return $"{baseUrl.TrimEnd('/')}/{token}";
    }
}
