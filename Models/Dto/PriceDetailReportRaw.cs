#nullable enable
namespace DespatchWeb.Models.Dto;

// Flat rows returned by JobRepository.GetPriceDetailReportAsync. The mapper turns them into the
// workbook. Deliberately dumb - no logic - so the repository stays a pure projection and all
// reconstruction lives in PriceDetailReportData.
public sealed class PriceDetailReportRaw
{
    public required IReadOnlyList<PriceDetailHeaderRow> Headers { get; init; }
    public required IReadOnlyList<PriceDetailLineRow> CurrentLines { get; init; }
    public required IReadOnlyList<PricingChangeRow> History { get; init; }
}
