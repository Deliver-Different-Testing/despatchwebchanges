#nullable enable

using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface ICourierRepository
{
    Task<ActiveCouriersViewModel?> GetCourierByIdAsync(int courierId);

    Task<TruckCourierStatusViewModel?> TruckCourierStatusAsync(int courierId);

   Task<IReadOnlyList<AvailableCourierPosition>> GetAvailableCouriersAsync(CourierLocationRequest data, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    Task<IReadOnlyList<ActiveCouriersViewModel>> ActiveCouriersAsync();

    Task<IReadOnlyList<Suggestion>> AllActiveCouriersAsync(string searchTerm, bool dgOnly = false, bool loggedInOnly = false);

    Task<IReadOnlyList<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    Task<ClearListViewModel> GetClearListsAsync(
        IReadOnlyList<int> despatchViewIds,
        DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null,
        CancellationToken cancellationToken = default);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false
    );

    Task<IReadOnlyList<Suggestion>> GetVehicleSizesAsync();

    Task<IReadOnlyList<Suggestion>> GetAllRegionsAsync();

    Task<IReadOnlyList<Suggestion>> GetAllSpeedsAsync();
    
    /* Driver Management Dashboard */
    Task<IReadOnlyList<Suggestion>> SearchAllCouriersAsync(string searchTerm);
    Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId);

    Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(CourierComplianceFilterRequest request);

    Task<CourierAfterHoursPaginatedResponse> GetAfterHoursCourierScheduleAsync(CourierAfterHoursFilterRequest request);
    Task<TodayActiveDriversPaginatedResponse> GetTodayActiveDriversAsync(TodayActiveDriversFilterRequest request);
    Task<IReadOnlyList<Suggestion>> GetAllFleetOptionsAsync();
    Task<CourierDailyEarningsPaginatedResponse> GetCourierDailyEarningsAsync(PaginatedRequest request);
    Task<PaginatedResponse<CourierEmailViewModel>> GetCourierEmailsAsync(PaginatedRequest request);
    Task SendEmailToCouriersAsync(GroupEmailDataViewModel request);
    Task UpdateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request);
    Task CreateAfterHoursCourierScheduleAsync(AfterHoursCourierScheduleViewModel request);
    Task DeleteAfterHoursCourierScheduleAsync(int afterHoursScheduleId);
    Task<Suggestion> GetExactCourierByCodeAsync(string courierCode);

    Task<IReadOnlyList<DriverWorkOverviewViewModel>> GetDriverWorkOverviewAsync();
    Task ResetClearListAreaOrderAsync(int courierId);

    /* Driver Management Dashboard - Export (no pagination) */
    Task<IReadOnlyList<TodayActiveDriversViewModel>> GetTodayActiveDriversForExportAsync(TodayActiveDriversFilterRequest request);
    Task<IReadOnlyList<CourierComplianceViewModel>> GetCourierComplianceForExportAsync(CourierComplianceFilterRequest request);
    Task<IReadOnlyList<AfterHoursCourierScheduleViewModel>> GetAfterHoursScheduleForExportAsync(CourierAfterHoursFilterRequest request);
    Task<IReadOnlyList<CourierEmailViewModel>> GetCourierEmailsForExportAsync(PaginatedRequest request);
    Task<IReadOnlyList<CourierDailyEarningsViewModel>> GetCourierDailyEarningsForExportAsync(PaginatedRequest request);
}
