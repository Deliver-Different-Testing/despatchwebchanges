using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<T> GetByIdAsync<T>(int id) where T : class;

    Task<List<DispatchJobViewModel>> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant, string clientIds, NationwideWidget windowPane, List<int> selectedViewIds);

    Task AddJobNationwideAsync(int jobId, AddFlightToJobDto flights,
        List<string> webhookIds, int? fromAirportId, int? toAirportId, bool overrideDeliverByTime = false);
    
    Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId);

    Task<List<AgentViewModel>> GetAgentsAsync(int jobId);

    Task AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false);
    Task<List<Suggestion>> GetActiveAirlineOptionsAsync();
    Task<List<string>> GetActiveAirlineCodesAsync();
    Task<string> GetAirlineCodeById(int airlineId);
    Task SendAgentRequestMessageAsync(int agentId, int jobId);
    Task<List<Suggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true);
    Task<string> GetSingleAirportCodeByIdAsync(int airportId);
    Task RestoreNationwideJobAsync(int jobId);
    Task<List<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm);
    Task<List<string>> GetFlightWebhookIdByJobIdAsync(int jobId);
    Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId);
    Task<bool> IsHolidayAsync(int clientId, DateTime bookTime);
    Task<bool> IsAfterHoursAsync(int clientId, DateTime bookTime, bool isHoliday);
    Task<int?> GetFlightCarrierIdByCodeAsync(string carrierCode);
    Task<string> GetZoneNameAsync(int carrierId, string state, string city);
    Task<int?> GetAirFreightRateIdFromZoneComboAsync(int carrierId, string fromZoneName, string toZoneName);
    Task<List<AirFreightRate>> GetAirFreightRatesAsync(int airFreightRateId);

    Task<ExtraRateResultDto> CalculateExtraRatesAsync(
        decimal totalWeight, int quantity, decimal cubic, int totalPallets, int extraStopOffs,
        int vehicleSizeId, bool dangerousGoods, decimal dryIceWeight, int? waitTime,
        int? extraChargeId, bool isHoliday, bool isAfterHours, decimal fuelSurcharge,
        int? fromZoneCongestionId = null, int? toZoneCongestionId = null);

    Task<string> GetAgentNameAsync(int agentId);
    Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId);
    Task<List<Suggestion>> GetAgentOptionsByAirportAsync(int airportId);
    Task<List<Suggestion>> GetAllActiveAirportsWithAgentsAsync();
    Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request);
    Task RemoveRecoveryAgentAsync(int recoveryId);
    Task<bool> CanAssignAgentToJobAsync(int agentJobId);
    Task<string> GetWebhookEventsAsStringAsync();
    Task<List<Suggestion>> GetWebhookEventsAsListAsync();
    Task<DateTime?> GetDeliverByTimeByJobIdAsync(int jobId);
}