using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface ICourierRepository
{
    Task<List<TruckCourierStatusViewModel>> TruckCourierStatusAsync(string courierId);

    Task AddEventAsync(string jobNo, int clientId, string contact, int staffId, int? courierId, int jobId, int jobType,
        string despatcherName, string notes, int eventType, float? lateTime = null, DateTime? etaTime = null,
        bool close = false);

    List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat);
    Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync();

    Task<List<Suggestion>> AllActiveCouriersAsync(string searchTerm);

    Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end);

    Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    CourierLocation Location(string code);
    Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds, bool isUsTenant);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(int clearListAreaId,
        Country country, bool includeCouriers = false);

    Task<List<Suggestion>> GetVehicleSizesAsync();

    Task<List<Suggestion>> GetAllRegionsAsync();

    Task<List<Suggestion>> GetAllSpeedsAsync();
}