#nullable enable
namespace DespatchWeb.Models.Dto;

public sealed class SplitPricingBreakdownLegDto
{
    public int JobId { get; init; }
    public required string JobNumber { get; init; }
    public string? DriverName { get; init; }
    public decimal SharePercent { get; init; }
    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
    public decimal MarginPercent { get; init; }
    public bool CostLocked { get; init; }
    public string? CostLockReason { get; init; }
}
