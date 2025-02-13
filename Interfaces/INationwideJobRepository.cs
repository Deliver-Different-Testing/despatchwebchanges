using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<List<JobViewModel>> NationwideJobListAsync(string order, string orderDirection, bool isInternal,
        string clientIds,
        NationwideWidget windowPane,
        List<int> selectedViewIds, DispatchStatus status = DispatchStatus.All);

    Task AddJobNationwideAsync(int jobId, ScheduledFlight flight, string webhookAlertId);

    Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId);

    Task<List<string>> GetActiveAirlineCodesAsync();

    Task<List<AgentViewModel>> GetAgentsAsync(int jobId);

    Task<bool> AddAgentToJobAsync(int agentId, int jobId);

    Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierName, bool extraStopOffs,
        DateTime? bookTime);
}
