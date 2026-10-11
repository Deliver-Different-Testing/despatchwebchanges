#nullable enable
namespace DespatchWeb.Models;

public sealed record SplitPricingLegCostLock(bool Locked, string? Reason);
