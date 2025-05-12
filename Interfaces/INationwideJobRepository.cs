using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.FlightStats;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<List<DispatchJobViewModel>> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant, string clientIds, NationwideWidget windowPane, List<int> selectedViewIds);

    Task AddJobNationwideAsync(int jobId, AddFlightToJobDto flight, List<string> webhookIds);

    Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId);

    Task<List<AgentViewModel>> GetAgentsAsync(int jobId);

    Task<bool> AddAgentToJobAsync(int agentId, int jobId);

    Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierName, bool extraStopOffs,
        DateTime? bookTime);

    Task<List<Suggestion>> GetActiveAirlineOptionsAsync();
    Task SendAgentRequestMessageAsync(int agentId, int jobId);
    Task<List<Suggestion>> GetNearbyAirportsAsync(int jobId, int? maxDistanceMiles = 250);
    Task<string> GetSingleAirportCodeByIdAsync(int airportId);
    Task RestoreNationwideJobAsync(int jobId);
    Task<List<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm);
    Task<List<string>> GetFlightWebhookIdByJobIdAsync(int jobId);
}
