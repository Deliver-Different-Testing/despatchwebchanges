using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

// Builds the Price Detail Report workbook for a filtered job set. Read-only export - mirrors
// IJobReportService / IPodReportService in shape.
public interface IPriceReportService
{
    Task<(byte[] FileBytes, string FileName)> GeneratePriceDetailReportAsync(
        PriceDetailReportRequest request, CancellationToken ct = default);
}
