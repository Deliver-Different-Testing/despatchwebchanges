using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface ICourierRepository
{
    Task<List<DES_qryTruckCourierStatusResult>> TruckCourierStatusAsync(string courierId);

    Task AddEventAsync(string jobNo, int clientId, string contact, int staffId, int? courierId, int jobId, int jobType,
        string despatcherName, string notes, int eventType, float? lateTime = null, DateTime? etaTime = null,
        bool close = false);

    List<AvailableCourierPosition> GetAvailableCouriers(decimal minLng, decimal minLat, decimal maxLng, decimal maxLat);
    Task<List<PotentialCouriersViewModel>> GetPotentialCouriersAsync(int jobId);

    /// <summary>
    /// filters by active, sms setting and logged in
    /// </summary>
    /// <returns></returns>
    Task<List<ActiveCouriersViewModel>> ActiveCouriersAsync();

    /// <summary>
    /// All active couriers regardless of logged in or not via search
    /// </summary>
    /// <returns></returns>
    Task<List<AllCourierActiveViewModel>> AllActiveCouriersAsync(string searchTerm);

    Task<List<CourierPosition>> GetCourierRouteAsync(string code, DateTime? start, DateTime? end);

    /// <summary>
    /// All active couriers regardless of logged in or not
    /// </summary>
    /// <returns></returns>
    Task<List<ActiveCouriersViewModel>> AllActiveCouriersAsync();

    CourierLocation Location(string code);
    Task<ClearListViewModel> GetClearListsAsync(List<int> despatchViewIds);
    Task<int> ClearListTotalRemainingAsync(string area);

    Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(int clearListAreaId,
        Country country, bool includeCouriers = false);
}