using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ICourierRepository
{
    Task<ActiveCouriersViewModel> GetCourierByIdAsync(int courierId);

    Task<List<TruckCourierStatusViewModel>> TruckCourierStatusAsync(string courierId);

    Task AddEventAsync(
        int jobId,
        int staffId,
        string despatcherName,
        string notes,
        int eventType,
        float? lateTime = null,
        DateTime? etaTime = null,
        bool close = false
    );

   Task<List<AvailableCourierPosition>> GetAvailableCouriers(
        decimal minLng,
        decimal minLat,
        decimal maxLng,
        decimal maxLat,
        bool isUsTenant
    );

    Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync();

    Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm);

    Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end);

    Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    CourierLocation Location(string code);
    Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds, bool isUsTenant);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false
    );

    Task<List<Suggestion>> GetVehicleSizesAsync();

    Task<List<Suggestion>> GetAllRegionsAsync();

    Task<List<Suggestion>> GetAllSpeedsAsync();
}
