using DespatchWeb.Models.Dto;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task RateJobNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task RateJobUsAsync(JobRatingDetailsDto jobDetails);
    Task<decimal> GetJobRateNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task<decimal> GetJobRateUsAsync(JobRatingDetailsDto jobDetails);

    /// <summary>
    /// Applies bulk price updates from an uploaded spreadsheet and returns the results.
    /// </summary>
    /// <param name="file">The uploaded spreadsheet file (xls, xlsx, or csv).</param>
    /// <param name="pricingMode">The pricing mode: 'recalculate', 'base', or 'gross'.</param>
    /// <returns>Response containing updated job prices and summary statistics.</returns>
    Task<BulkPricePreviewResponse> ApplyBulkPriceUpdateAsync(IFormFile file, string pricingMode);
}
