using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<JobSearchResult> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant, string clientIds, NationwideWidget windowPane, List<int> selectedViewIds);

    Task AddJobNationwideAsync(AssignFlightToJobRequest requestData, List<string> webhookIds);

    Task<List<AgentViewModel>> GetAgentsAsync(int jobId);

    Task AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false);
    Task<List<AirlineSuggestion>> GetActiveAirlineOptionsAsync();
    Task<List<string>> GetActiveAirlineCodesAsync();
    Task<string> GetAirlineCodeByIdAsync(int airlineId);
    Task SendAgentRequestMessageAsync(int agentId, int jobId);
    Task<List<AirportSuggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true);
    Task RestoreNationwideJobAsync(int jobId);
    Task<List<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm);
    Task<List<string>> GetFlightWebhookIdByJobIdAsync(int jobId);
    Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId);

    Task<string> GetAgentNameAsync(int agentId);
    Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId);
    Task<List<Suggestion>> GetAgentOptionsByAirportAsync(int airportId);
    Task<List<Suggestion>> GetAllActiveAirportsWithAgentsAsync();
    Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request);
    Task RemoveRecoveryAgentAsync(int recoveryId);
    Task<string> GetWebhookEventsAsStringAsync();

    Task<FlightCargoProcessingModel> CalculateCargoReadyTimeAsync(int jobId, string carrierFsCode,
        DateTime flightArrivalTime);

    Task<bool> CanAssignAgentToJobAsync(int agentJobId);

    Task<FlightRateCalculationDto> GetFlightRateCalculationDtoAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime);

    Task<List<GetAirportsDto>> GetAllActiveAirportsAsync();
    
    Task<List<FlightRateDto>> GetCarrierFlightRatesAsync(FlightRateCalculationDto dto);
}