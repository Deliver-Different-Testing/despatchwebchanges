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
}
