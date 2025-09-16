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

    Task<List<TruckCourierStatusViewModel>> TruckCourierStatusAsync(string courierId);

   Task<List<AvailableCourierPosition>> GetAvailableCouriersAsync(CourierLocationRequest data);

    Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync();

    Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm);

    Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false
    );

    Task<List<Suggestion>> GetVehicleSizesAsync();

    Task<List<Suggestion>> GetAllRegionsAsync();

    Task<List<Suggestion>> GetAllSpeedsAsync();
    Task<CourierDataDashboardViewModel> GetCourierDetailsForDashboardAsync(int courierId);

    Task<CourierCompliancePaginatedResponse> GetAllCourierComplianceAsync(
        string searchTerm,
        int page = 1,
        int pageSize = 10,
        string sortBy = "Code",
        bool sortDescending = false);
    Task<List<AfterHoursCourierScheduleViewModel>> GetAfterHoursCourierScheduleAsync(string searchTerm);
    Task<List<CourierDataDashboardViewModel>> FindCourierByRegoAsync(string rego);
}
