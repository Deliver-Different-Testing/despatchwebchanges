using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IFlightRateService
{
    Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime);
}
