using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public sealed class LabelTemplateResolver : ILabelTemplateResolver
{
    // Calls the shared DB function so this can't drift from booking and the renderer's own lookups.
    public Task<int?> ResolveAsync(DespatchContext context, int? clientId, int? speedId, bool isBulk, CancellationToken ct = default) =>
        context.Database
            .SqlQuery<int?>($"SELECT TemplateId AS Value FROM dbo.REP_fncLabelTemplate({clientId}, {speedId}, {isBulk})")
            .FirstOrDefaultAsync(ct);
}
