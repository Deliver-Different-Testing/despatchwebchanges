using DespatchWeb.EntityClasses;

namespace DespatchWeb.Interfaces;

public interface ILabelTemplateResolver
{
    /// <summary>
    /// The label template for a client and speed: the client's own, then the speed's, then the tenant's
    /// default job or bulk label. Same order as the booking site and the label renderer.
    /// </summary>
    /// <returns>The template id, or null (or 0, from an unset default) when none is set up.</returns>
    Task<int?> ResolveAsync(DespatchContext context, int? clientId, int? speedId, bool isBulk, CancellationToken ct = default);
}
