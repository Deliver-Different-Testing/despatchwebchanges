using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

public class ClearListEnvelopeService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService) : IClearListEnvelopeService
{
    private DespatchContext _context;

    private DespatchContext Context => _context ??= contextFactory.CreateDbContext();

    public async Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false)
    {
        if (clearListAreaId <= 0)
            throw new ArgumentException("Invalid clearListAreaId", nameof(clearListAreaId));

        if (!Enum.IsDefined(typeof(Country), country))
            throw new ArgumentException("Invalid country", nameof(country));

        return country switch
        {
            Country.Nz => await GetClearListEnvelopeNzAsync(clearListAreaId, includeCouriers),
            Country.Us => await GetClearListEnvelopeUsAsync(clearListAreaId, includeCouriers),
            _ => throw new ArgumentOutOfRangeException(nameof(country), country, null)
        };
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeUsAsync(
        int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetClearListAreaBoundariesQuery(clearListAreaId);

        if (!includeCouriers)
            return await CalculateEnvelopeAsync(query);
            
        var courierLocationsQuery = GetCourierLocationsQueryUs(clearListAreaId);
        var unassignedJobLocationsQuery = GetUnassignedJobLocationsQueryUs(clearListAreaId);

        query = query
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassignedJobLocationsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeNzAsync(
        int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetAreaPolygonsQueryNz(clearListAreaId);

        if (!includeCouriers)
            return await CalculateEnvelopeAsync(query);
            
        var courierLocationsQuery = GetCourierLocationsQueryNz(clearListAreaId);
        var unassignedJobsQuery = GetUnassignedJobLocationsQueryNz(clearListAreaId);

        query = query
            .Concat(courierLocationsQuery ?? throw new InvalidOperationException())
            .Concat(unassignedJobsQuery ?? throw new InvalidOperationException());

        return await CalculateEnvelopeAsync(query);
    }

    private IQueryable<EnvelopeCoordinate> GetClearListAreaBoundariesQuery(int clearListAreaId)
    {
        return Context.TblClearListAreas
            .Where(area => area.ClearListAreaId == clearListAreaId)
            .SelectMany(area => area.TblClearListAreaPolygons)
            .Select(polygon => polygon.ZipPolygon)
            .Select(zipPolygon => new EnvelopeCoordinate
            {
                Longitude = (decimal)zipPolygon.Longitude,
                Latitude = (decimal)zipPolygon.Latitude
            });
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryUs(int clearListAreaId)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        return Context.TucCouriers
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                .SelectMany(jt => Context.ZipPolygons
                    .Where(zp => zp.Latitude == jt.PickUpLatitude && 
                                 zp.Longitude == jt.PickUpLongitude)
                    .SelectMany(zp => zp.TblClearListAreaPolygons
                        .Where(clap => clap.ClearListArea.ClearListAreaId == clearListAreaId && 
                                      clap.ClearListArea.ChannelId == c.UccrChannelId)
                        .Select(clap => new { Courier = c, Job = jt }))))
            .Where(x => x.Courier.CourierLogInOut.LogInTime <= currentDate &&
                       x.Courier.CourierLogInOut.LogOutTime == null)
            .Select(x => new EnvelopeCoordinate
            {
                Longitude = (decimal)x.Courier.CourierGps.Longitude,
                Latitude = (decimal)x.Courier.CourierGps.Latitude
            });
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryUs(int clearListAreaId)
    {
        return Context.TucJobs
            .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt => Context.ZipPolygons
                .Where(zp => zp.Latitude == jt.PickUpLatitude && 
                            zp.Longitude == jt.PickUpLongitude)
                .SelectMany(zp => zp.TblClearListAreaPolygons
                    .Where(clazp => clazp.ClearListAreaId == clearListAreaId)
                    .Select(clazp => new EnvelopeCoordinate
                    {
                        Longitude = (decimal)jt.DeliveryLongitude,
                        Latitude = (decimal)jt.DeliveryLatitude
                    })));
    }

    private IQueryable<EnvelopeCoordinate> GetAreaPolygonsQueryNz(int clearListAreaId)
    {
        return Context.TblClearListAreas
            .Where(cla => cla.ClearListAreaId == clearListAreaId)
            .SelectMany(cla => cla.TblClearListAreaPolygons
                .SelectMany(clap => clap.Polygon.TblPolygonGps
                    .Select(pgps => new EnvelopeCoordinate
                    {
                        Longitude = pgps.Longitude,
                        Latitude = pgps.Latitude
                    })));
    }

    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryNz(int clearListAreaId)
    {
        return Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogInTime.Date == DateTime.Today && 
                       c.CourierLogInOut.LogOutTime == null)
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                    .SelectMany(dps => dps.Polygon.TblClearListAreaPolygons
                        .Where(dclap => dclap.ClearListArea.ClearListAreaId == clearListAreaId && 
                                       dclap.ClearListArea.ChannelId == c.UccrChannelId)
                        .Select(dclap => new EnvelopeCoordinate
                        {
                            Longitude = (decimal)c.CourierGps.Longitude,
                            Latitude = (decimal)c.CourierGps.Latitude
                        }))));
    }

    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryNz(int clearListAreaId)
    {
        return Context.TucJobs
            .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                .SelectMany(ps => ps.Polygon.TblClearListAreaPolygons
                    .Where(clap => clap.ClearListAreaId == clearListAreaId)
                    .Select(clap => new EnvelopeCoordinate
                    {
                        Longitude = (decimal)jt.DeliveryLongitude,
                        Latitude = (decimal)jt.DeliveryLatitude
                    })));
    }

    private static async Task<ClearListEnvelopeViewModel> CalculateEnvelopeAsync(
        IQueryable<EnvelopeCoordinate> query)
    {
        var result = await query
            .GroupBy(_ => 1)
            .Select(g => new ClearListEnvelopeViewModel
            {
                MinimumLongitude = g.Min(x => x.Longitude),
                MinimumLatitude = g.Min(x => x.Latitude),
                MaximumLongitude = g.Max(x => x.Longitude),
                MaximumLatitude = g.Max(x => x.Latitude)
            })
            .FirstOrDefaultAsync();

        return result ?? new ClearListEnvelopeViewModel();
    }

    public void Dispose()
    {
        _context?.Dispose();
    }
}