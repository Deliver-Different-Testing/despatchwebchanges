#nullable enable

using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<JobSearchResult> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant, string? clientIds, NationwideWidget windowPane, IReadOnlyList<int> selectedViewIds,
        CancellationToken cancellationToken = default);

    Task AddJobNationwideAsync(AssignFlightToJobRequest requestData, IReadOnlyList<string> webhookIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentViewModel>> GetAgentsAsync(int jobId);

    Task AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false);
    Task<IReadOnlyList<AirlineSuggestion>> GetActiveAirlineOptionsAsync();
    Task<IReadOnlyList<string>> GetActiveAirlineCodesAsync();
    Task<string?> GetAirlineCodeByIdAsync(int airlineId);
    Task SendAgentRequestMessageAsync(int agentId, int jobId);
    Task<IReadOnlyList<AirportSuggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true);
    Task RestoreNationwideJobAsync(int jobId);
    Task<IReadOnlyList<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm, bool? isNetworkPartner = null);
    Task<IReadOnlyList<string>> GetFlightWebhookIdByJobIdAsync(int jobId);
    Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId);

    Task<string?> GetAgentNameAsync(int agentId);
    Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId);
    Task<IReadOnlyList<Suggestion>> GetAgentOptionsByAirportAsync(int airportId);
    Task<IReadOnlyList<Suggestion>> GetAllActiveAirportsWithAgentsAsync();
    Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request);
    Task RemoveRecoveryAgentAsync(int recoveryId);
    Task<string> GetWebhookEventsAsStringAsync();

    Task<FlightCargoProcessingModel> CalculateCargoReadyTimeAsync(int jobId, string carrierFsCode,
        DateTime flightArrivalTime);

    Task<bool> CanAssignAgentToJobAsync(int agentJobId);

    Task<FlightRateCalculationDto> GetFlightRateCalculationDtoAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime);

    Task<IReadOnlyList<GetAirportsDto>> GetAllActiveAirportsAsync();
    
    Task<IReadOnlyList<FlightRateDto>> GetCarrierFlightRatesAsync(FlightRateCalculationDto dto);
}