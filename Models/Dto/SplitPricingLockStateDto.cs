#nullable enable
namespace DespatchWeb.Models.Dto;

public sealed class SplitPricingLockStateDto
{
    public bool RevenueLocked { get; init; }
    public string? RevenueLockReason { get; init; }
    public bool ShareLocked { get; init; }
    public string? ShareLockReason { get; init; }
}
