using DespatchWeb.Models.Dto;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IRateJobService
{
    Task RateJobNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task RateJobUsAsync(JobRatingDetailsDto jobDetails);
    Task<ApiRerate> GetJobRateNzAsync(JobRatingDetailsDtoNz jobDetails);
    Task<ApiRerate> GetJobRateUsAsync(JobRatingDetailsDto jobDetails);

    /// <summary>
    /// Road distance in miles between two coordinates, or 0 when any coordinate is missing or zero.
    /// </summary>
    Task<double> GetRoadDistanceMilesAsync(
        decimal? fromLatitude,
        decimal? fromLongitude,
        decimal? toLatitude,
        decimal? toLongitude);

    /// <summary>
    /// Applies bulk price updates from an uploaded spreadsheet and returns the results.
    /// </summary>
    /// <param name="file">The uploaded spreadsheet file (xls, xlsx, or csv).</param>
    /// <param name="pricingMode">The pricing mode: 'recalculate', 'base', or 'gross'.</param>
    /// <returns>Response containing updated job prices and summary statistics.</returns>
    Task<BulkPricePreviewResponse> ApplyBulkPriceUpdateAsync(IFormFile file, string pricingMode);
}
