#nullable enable
namespace DespatchWeb.Models;

/// <summary>A split leg's job number and driver name, from either TucJobs or TucJobArchives.</summary>
public sealed record SplitPricingLegJobRow(int UcjbId, string UcjbNumber, string? DriverName);
