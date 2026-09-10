using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Services;

public class SuburbResolver(IDbContextFactory<DespatchContext> contextFactory) : ISuburbResolver
{
    private const int FallbackUnknownSuburbId = 152;

    public async Task<int?> ResolveAsync(string suburbName, string postCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(suburbName))
        {
            return null;
        }

        var parsedPostCode = int.TryParse(postCode, out var zip) && zip > 0 ? zip : (int?)null;

        try
        {
            await using var context = await contextFactory.CreateDbContextAsync(ct);

            var unknownId = await context.TucSuburbs
                .Where(s => s.UcsuName == "Unknown")
                .Select(s => (int?)s.UcsuId)
                .FirstOrDefaultAsync(ct) ?? FallbackUnknownSuburbId;

            var resolved = await LookupAsync(context, suburbName, parsedPostCode, ct);

            if (IsUnresolved(resolved, unknownId))
            {
                var abbreviated = Abbreviate(suburbName);
                if (!string.Equals(abbreviated, suburbName, StringComparison.Ordinal))
                {
                    resolved = await LookupAsync(context, abbreviated, parsedPostCode, ct);
                }
            }

            return IsUnresolved(resolved, unknownId) ? null : resolved;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Log.Warning(ex, "Could not resolve suburb {Suburb} {PostCode}", suburbName, postCode);
            return null;
        }
    }

    private static bool IsUnresolved(int? suburbId, int unknownId) =>
        suburbId is null or 0 || suburbId == unknownId;

    private static Task<int?> LookupAsync(DespatchContext context, string suburbName, int? postCode,
        CancellationToken ct) =>
        context.TucJobs
            .Select(_ => DespatchContext.UTL_fncSuburb_FromNameWithPostCode(suburbName, null, postCode))
            .FirstOrDefaultAsync(ct);

    private static string Abbreviate(string suburbName) => suburbName
        .Replace("Saint", "St", StringComparison.OrdinalIgnoreCase)
        .Replace("Mount", "Mt", StringComparison.OrdinalIgnoreCase)
        .Replace("Point", "Pt", StringComparison.OrdinalIgnoreCase);
}
