namespace DespatchWeb.Interfaces;

public interface IFlightRateService
{
    Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime);
}
