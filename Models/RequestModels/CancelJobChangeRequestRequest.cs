#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class CancelJobChangeRequestRequest
{
    public int RequestId { get; init; }
    public byte[]? RowVersion { get; init; }
    public string? Reason { get; init; }
}
