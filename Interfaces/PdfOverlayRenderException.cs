#nullable enable
namespace DespatchWeb.Interfaces;

/// <summary>
/// Thrown by <see cref="IPdfOverlayClient.RenderJobAsync"/> when the render endpoint returns a real
/// failure (any non-success status other than 404). Carries the endpoint's status and message so the
/// caller can surface the actual cause rather than mislabelling it "no template available".
/// </summary>
public sealed class PdfOverlayRenderException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
