using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface ICourierRepository
{
    Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId);

    Task<TruckCourierStatusViewModel> TruckCourierStatusAsync(int courierId);

   Task<List<AvailableCourierPosition>> GetAvailableCouriersAsync(CourierLocationRequest data);

    Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync();

    Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm, bool dgOnly = false, bool loggedInOnly = false);

    Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    Task<ClearListViewModel> GetClearListsAsync(
        List<int> despatchViewIds,
        DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false
    );

    Task<List<Suggestion>> GetVehicleSizesAsync();

    Task<List<Suggestion>> GetAllRegionsAsync();

    Task<List<Suggestion>> GetAllSpeedsAsync();
    
    /* Driver Management Dashboard */
    Task<List<Suggestion>> SearchAllCouriersAsync(string searchTerm);
    Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId);

    Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(CourierComplianceFilterRequest request);

    Task<CourierAfterHoursPaginatedResponse> GetAfterHoursCourierScheduleAsync(CourierAfterHoursFilterRequest request);
    Task<TodayActiveDriversPaginatedResponse> GetTodayActiveDriversAsync(TodayActiveDriversFilterRequest request);
    Task<List<Suggestion>> GetAllFleetOptionsAsync();
    Task<CourierDailyEarningsPaginatedResponse> GetCourierDailyEarningsAsync(PaginatedRequest request);
    Task<PaginatedResponse<CourierEmailViewModel>> GetCourierEmailsAsync(PaginatedRequest request);
    Task SendEmailToCouriersAsync(GroupEmailDataViewModel request);
    Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request);
    Task CreateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request);
    Task DeleteAfterHoursCourierScheduleAsync(int afterHoursScheduleId);
    Task<Suggestion> GetExactCourierByCodeAsync(string courierCode);

    Task<List<DriverWorkOverviewViewModel>> GetDriverWorkOverviewAsync();
    Task ResetClearListAreaOrderAsync(int courierId);
}
