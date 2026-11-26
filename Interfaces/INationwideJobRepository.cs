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

    Task AddJobNationwideAsync(AssignFlightToJobRequest? requestData, IReadOnlyList<string>? webhookIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SavedFlightCandidate>> GetSavedFlightCandidatesAsync(IReadOnlyList<int>? jobIds);

    Task<IReadOnlyList<AgentViewModel>> GetAgentsAsync(int jobId);

    /// <param name="resend">Send the agent alert even if this agent already has it for this job.</param>
    Task<AgentInboundEmailResult> AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false,
        string? emailSubject = null, string? emailNote = null, bool resend = false);

    /// <summary>
    /// Hands <paramref name="jobId"/> to a network partner by stamping
    /// <c>tucJob.NpAgentId</c>, which is what the partner's row-level query filter
    /// keys off. Leaves the job status and dispatch stamps alone and sends no email.
    /// </summary>
    Task AssignNpAgentToJobAsync(int npAgentId, int jobId);

    /// <summary>
    /// Assigns one agent across many jobs. A job that fails its flight gate (or any
    /// other error) is reported in the result rather than aborting the batch.
    /// </summary>
    Task<IReadOnlyList<BulkAssignmentResult>> AssignAgentToJobsAsync(int agentId, IReadOnlyList<int> jobIds,
        bool includeStopJobs = false, string? emailSubject = null, string? emailNote = null, bool resend = false);

    /// <summary>Assigns one network partner across many jobs, reporting per job.</summary>
    Task<IReadOnlyList<BulkAssignmentResult>> AssignNpAgentToJobsAsync(int npAgentId, IReadOnlyList<int> jobIds);

    /// <summary>
    /// Pre-flight check (no side effects): would assigning <paramref name="agentId"/> to
    /// <paramref name="jobId"/> email the agent the inbound-agent link, and to what address?
    /// </summary>
    Task<AgentInboundEmailResult> GetAgentInboundEmailPreviewAsync(int agentId, int jobId);

    /// <summary>
    /// The agent alert for this leg as it would be sent: the tenant's template for the leg's alert type (or the
    /// built-in default), every token filled, <paramref name="emailNote"/> shown above the message.
    /// <paramref name="emailSubject"/> replaces the subject when not blank.
    /// </summary>
    Task<AgentAlertEmail> ComposeAgentAlertAsync(int agentId, int jobId, string? emailSubject = null,
        string? emailNote = null);

    Task<IReadOnlyList<AirlineSuggestion>> GetActiveAirlineOptionsAsync();
    /// <summary>
    /// Queues the agent alert and its AgentAlertLog row in one transaction. Without <paramref name="resend"/> it sends
    /// nothing when this agent already has this alert for this job (<see cref="AgentInboundEmailStatus.AlreadySent"/>).
    /// </summary>
    Task<AgentInboundEmailStatus> SendAgentRequestMessageAsync(int agentId, int jobId, string? emailSubject = null,
        string? emailNote = null, bool resend = false);
    Task<IReadOnlyList<AirportSuggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true);
    Task RestoreNationwideJobAsync(int jobId);
    Task<IReadOnlyList<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm, bool? isNetworkPartner = null);
    Task<IReadOnlyList<string>> GetFlightWebhookIdByJobIdAsync(int jobId);

    Task<int?> GetActiveFlightCarrierIdByCodeAsync(string carrierCode);
    Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId);

    Task<string?> GetAgentNameAsync(int agentId);
    Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId);
    Task<IReadOnlyList<Suggestion>> GetAgentOptionsByAirportAsync(int airportId);
    Task<IReadOnlyList<Suggestion>> GetAllActiveAirportsWithAgentsAsync();
    Task<IReadOnlyList<Suggestion>> GetAllActiveAirportSuggestionsAsync();
    Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request);
    Task RemoveRecoveryAgentAsync(int recoveryId);
    Task<string> GetWebhookEventsAsStringAsync();

    Task<FlightCargoProcessingModel> CalculateCargoReadyTimeAsync(int jobId, string carrierFsCode,
        DateTime flightArrivalTime);

    Task<bool> CanAssignAgentToJobAsync(int agentJobId);

    Task<FlightRateCalculationDto> GetFlightRateCalculationDtoAsync(int jobId, string carrierCode, bool extraStopOffs,
        DateTime? bookTime);

    Task<IReadOnlyList<FlightRateDto>> GetCarrierFlightRatesAsync(FlightRateCalculationDto dto);
}