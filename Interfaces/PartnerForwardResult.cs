#nullable enable
namespace DespatchWeb.Interfaces;

public sealed class PartnerForwardResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
}
