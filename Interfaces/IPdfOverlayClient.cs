#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Calls the Configurator's PDF Overlay render endpoint to produce a job's document by stamping its
/// data onto a customer-supplied template. Returns <c>null</c> when no template applies (no active
/// template for the client + document type, the feature isn't configured for this deployment, or the
/// call fails) — the signal for the caller to fall back to the built-in report.
/// </summary>
public interface IPdfOverlayClient
{
    Task<byte[]?> TryRenderJobAsync(int jobId, string documentType, CancellationToken ct = default);

    /// <summary>
    /// Lists the overlay document types configured for this job's tenant, each flagged with whether a
    /// template resolves for the job's client (<see cref="OverlayDocument.Available"/>). The export menu
    /// shows every entry and greys out the unavailable ones. Returns <c>null</c> when the feature isn't
    /// configured for this deployment, there's no tenant on the request, or the call fails — the signal
    /// for the caller to offer no overlay documents. Proof-of-delivery is excluded (it's reached through
    /// the existing POD download).
    /// </summary>
    Task<IReadOnlyList<OverlayDocument>?> ListJobDocumentsAsync(int jobId, CancellationToken ct = default);
}

/// <summary>One overlay document offered in the job export menu.</summary>
/// <param name="DocumentType">The document type key passed back to the render endpoint.</param>
/// <param name="DisplayName">Human-readable label for the menu item.</param>
/// <param name="Available">True when a template resolves for this job's client; false renders the item disabled.</param>
public sealed record OverlayDocument(string DocumentType, string DisplayName, bool Available);
