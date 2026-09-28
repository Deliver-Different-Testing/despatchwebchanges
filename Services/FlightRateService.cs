using DespatchWeb.Interfaces;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for calculating air freight rates using the DD_stpGetCarrierFlightRate stored procedure.
/// </summary>
public sealed class FlightRateService(INationwideJobRepository repository) : IFlightRateService
{
    /// <summary>
    /// Calculates the flight rate for a job based on carrier, route, weight, and booking time.
    /// </summary>
    /// <param name="jobId">The job ID to get rate calculation data for.</param>
    /// <param name="carrierCode">The airline carrier code.</param>
    /// <param name="extraStopOffs">Whether extra stop-offs are included.</param>
    /// <param name="bookTime">Optional booking time for holiday/after-hours rate adjustments.</param>
    /// <returns>The calculated flight rate, or 0 if no rate is available.</returns>
    public async Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime)
    {
        try
        {
            // Get the job data required for rate calculation
            var dto = await repository.GetFlightRateCalculationDtoAsync(jobId, carrierCode, extraStopOffs, bookTime);
            ArgumentNullException.ThrowIfNull(dto);

            // Call the stored procedure to calculate rates
            var rates = await repository.GetCarrierFlightRatesAsync(dto);

            if (rates.Count == 0)
            {
                Log.Debug("No flight rates returned for JobId: {JobId}, CarrierCode: {CarrierCode}",
                    jobId, carrierCode);
                return 0;
            }

            var rate = rates[0].Rate;
            Log.Debug("Flight rate calculated for JobId: {JobId}, CarrierCode: {CarrierCode}, Rate: {Rate}",
                jobId, carrierCode, rate);

            return rate;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error calculating flight rate for JobId: {JobId}, CarrierCode: {CarrierCode}",
                jobId, carrierCode);
            return 0;
        }
    }
}