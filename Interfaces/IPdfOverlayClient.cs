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
    /// <summary>
    /// Renders a job's overlay document. Returns the stamped PDF on success, or <c>null</c> for the
    /// genuine "nothing to render" cases (feature unconfigured, no tenant on the request, or the render
    /// endpoint reports no active template — HTTP 404). Unlike <see cref="TryRenderJobAsync"/> it does
    /// <b>not</b> swallow real failures: a render-side error (e.g. an undecodable image → 4xx/5xx) throws
    /// <see cref="PdfOverlayRenderException"/> so the caller can surface the actual cause instead of
    /// mislabelling it "no template available".
    /// </summary>
    Task<byte[]?> RenderJobAsync(int jobId, string documentType, CancellationToken ct = default);

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

/// <summary>
/// Thrown by <see cref="IPdfOverlayClient.RenderJobAsync"/> when the render endpoint returns a real
/// failure (any non-success status other than 404). Carries the endpoint's status and message so the
/// caller can surface the actual cause rather than mislabelling it "no template available".
/// </summary>
public sealed class PdfOverlayRenderException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>One overlay document offered in the job export menu.</summary>
/// <param name="DocumentType">The document type key passed back to the render endpoint.</param>
/// <param name="DisplayName">Human-readable label for the menu item.</param>
/// <param name="Available">True when a template resolves for this job's client; false renders the item disabled.</param>
public sealed record OverlayDocument(string DocumentType, string DisplayName, bool Available);
