// Annotations only: the `?` annotations below are intentional, but the nullable-oblivious EF
// entity columns are cast to decimal inside SQL-translated projections, where a null yields SQL
// NULL rather than a client-side dereference.
#nullable enable annotations
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Service for calculating map envelope boundaries for clear list areas, including courier and job locations.
/// </summary>
public sealed class ClearListEnvelopeService(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantClock clock) : IClearListEnvelopeService, IDisposable, IAsyncDisposable
{
    private DespatchContext? _context;
    private DespatchContext Context => _context ??= contextFactory.CreateDbContext();

    /// <summary>
    /// Disposes the context created from the factory. Implemented for synchronous scope teardown
    /// (e.g. a DI container disposed synchronously); the async overload is preferred where available.
    /// </summary>
    public void Dispose() => _context?.Dispose();

    /// <summary>
    /// Disposes the context created from the factory. The scoped DI container invokes this at the
    /// end of the request scope; the factory hands ownership of the context to this service.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        if (_context is not null)
        {
            await _context.DisposeAsync();
        }
    }

    /// <summary>
    /// Calculates the bounding envelope (min/max lat/long) for a clear list area, optionally including courier and job positions.
    /// </summary>
    /// <param name="clearListAreaId">The ID of the clear list area.</param>
    /// <param name="country">The country (NZ, US or AU) to determine which polygon/location strategy to use.</param>
    /// <param name="includeCouriers">Whether to include courier and unassigned job locations in the envelope calculation.</param>
    /// <returns>The bounding envelope with min/max coordinates.</returns>
    public async Task<ClearListEnvelopeViewModel> GetClearListAreaEnvelopeAsync(
        int clearListAreaId,
        Country country,
        bool includeCouriers = false)
    {
        if (clearListAreaId <= 0)
        {
            throw new ArgumentException("Invalid clearListAreaId", nameof(clearListAreaId));
        }

        if (!Enum.IsDefined(country))
        {
            throw new ArgumentException("Invalid country", nameof(country));
        }

        return country switch
        {
            Country.Nz => await GetClearListEnvelopeNzAsync(clearListAreaId, includeCouriers),
            Country.Us => await GetClearListEnvelopeUsAsync(clearListAreaId, includeCouriers),
            Country.Au => await GetClearListEnvelopeAuAsync(clearListAreaId, includeCouriers),
            _ => throw new ArgumentOutOfRangeException(nameof(country), country, null)
        };
    }

    /// <summary>
    /// Calculates the envelope for a US clear list area using zip polygon boundaries.
    /// </summary>
    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeUsAsync(
        int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetClearListAreaBoundariesQuery(clearListAreaId);

        if (!includeCouriers)
        {
            return await CalculateEnvelopeAsync(query);
        }

        var courierLocationsQuery = GetCourierLocationsQueryUs(clearListAreaId);
        var unassignedJobLocationsQuery = GetUnassignedJobLocationsQueryUs(clearListAreaId);

        query = query
            .Concat(courierLocationsQuery)
            .Concat(unassignedJobLocationsQuery);

        return await CalculateEnvelopeAsync(query);
    }

    /// <summary>
    /// Calculates the envelope for an AU clear list area. The area is a set of postcodes (ZipPolygon) like the US, but a
    /// geocoded AU address never sits exactly on a zip's centre point, so jobs are placed by their delivery postcode.
    /// </summary>
    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeAuAsync(
        int clearListAreaId,
        bool includeCouriers)
    {
        // Three small queries combined in memory: a SQL UNION over these navigation-shaped queries does not translate
        var coordinates = await GetClearListAreaBoundariesQuery(clearListAreaId).ToListAsync();

        if (includeCouriers)
        {
            coordinates.AddRange(await GetCourierAndJobLocationsAuAsync(clearListAreaId));
        }

        return coordinates.Count == 0
            ? new ClearListEnvelopeViewModel()
            : new ClearListEnvelopeViewModel
            {
                MinimumLongitude = coordinates.Min(x => x.Longitude),
                MinimumLatitude = coordinates.Min(x => x.Latitude),
                MaximumLongitude = coordinates.Max(x => x.Longitude),
                MaximumLatitude = coordinates.Max(x => x.Latitude)
            };
    }

    /// <summary>
    /// Calculates the envelope for a NZ clear list area using suburb polygon boundaries.
    /// </summary>
    private async Task<ClearListEnvelopeViewModel> GetClearListEnvelopeNzAsync(
        int clearListAreaId,
        bool includeCouriers)
    {
        var query = GetAreaPolygonsQueryNz(clearListAreaId);

        if (!includeCouriers)
        {
            return await CalculateEnvelopeAsync(query);
        }

        var courierLocationsQuery = GetCourierLocationsQueryNz(clearListAreaId);
        var unassignedJobsQuery = GetUnassignedJobLocationsQueryNz(clearListAreaId);

        query = query
            .Concat(courierLocationsQuery)
            .Concat(unassignedJobsQuery);

        return await CalculateEnvelopeAsync(query);
    }

    /// <summary>
    /// Gets the boundary coordinates query for a US clear list area using zip polygons.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetClearListAreaBoundariesQuery(int clearListAreaId) =>
        Context.TblClearListAreas
            .Where(area => area.ClearListAreaId == clearListAreaId)
            .SelectMany(area => area.TblClearListAreaPolygons)
            .Select(polygon => polygon.ZipPolygon)
            .Select(zipPolygon => new EnvelopeCoordinate
            {
                Longitude = (decimal)zipPolygon.Longitude,
                Latitude = (decimal)zipPolygon.Latitude
            });

    /// <summary>
    /// Gets GPS coordinates of logged-in couriers with active jobs in the US clear list area.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryUs(int clearListAreaId)
    {
        var currentDate = clock.TenantNow;

        return Context.TucCouriers
            .SelectMany(courier => courier.TucJobUcjbCouriers
                .Where(job => !job.UcjbJobDone && !job.UcjbVoid)
                .SelectMany(job => Context.ZipPolygons
                    .Where(zp => zp.Latitude == job.PickUpLatitude && 
                                 zp.Longitude == job.PickUpLongitude)
                    .SelectMany(zp => zp.TblClearListAreaPolygons
                        .Where(areaPolygon => areaPolygon.ClearListArea.ClearListAreaId == clearListAreaId && 
                                      areaPolygon.ClearListArea.ChannelId == courier.UccrChannelId)
                        .Select(areaPolygon => new { Courier = courier, Job = job }))))
            .Where(x => x.Courier.CourierLogInOut.LogInTime <= currentDate &&
                       x.Courier.CourierLogInOut.LogOutTime == null)
            .Select(x => new EnvelopeCoordinate
            {
                Longitude = (decimal)x.Courier.CourierGps.Longitude,
                Latitude = (decimal)x.Courier.CourierGps.Latitude
            });
    }

    /// <summary>
    /// Gets delivery coordinates of unassigned jobs in the US clear list area.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryUs(int clearListAreaId) =>
        Context.TucJobs
            .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt => Context.ZipPolygons
                .Where(zp => zp.Latitude == jt.PickUpLatitude && 
                             zp.Longitude == jt.PickUpLongitude)
                .SelectMany(zp => zp.TblClearListAreaPolygons
                    .Where(areaPolygon => areaPolygon.ClearListAreaId == clearListAreaId)
                    .Select(areaPolygon => new EnvelopeCoordinate
                    {
                        Longitude = (decimal)jt.DeliveryLongitude,
                        Latitude = (decimal)jt.DeliveryLatitude
                    })));

    /// <summary>
    /// AU: GPS positions of logged-in couriers on the area's channel who have an active job delivering to one of the area's
    /// postcodes, plus the delivery coordinates of unassigned jobs delivering to them. AU postcodes are 4 digits; jobs booked
    /// under the old US zip padding hold them as 5 (02000), so both forms are matched.
    /// Plain filters over a postcode list rather than the nested joins the US version uses.
    /// </summary>
    private async Task<List<EnvelopeCoordinate>> GetCourierAndJobLocationsAuAsync(int clearListAreaId)
    {
        var channelId = await Context.TblClearListAreas
            .Where(area => area.ClearListAreaId == clearListAreaId)
            .Select(area => (int?)area.ChannelId)
            .FirstOrDefaultAsync();

        var zips = await Context.TblClearListAreaPolygons
            .Where(polygon => polygon.ClearListAreaId == clearListAreaId && polygon.ZipPolygonId != null)
            .Select(polygon => polygon.ZipPolygon.Zip)
            .ToListAsync();

        if (channelId == null || zips.Count == 0)
        {
            return [];
        }

        var postcodes = zips.Concat(zips.Select(zip => "0" + zip)).ToList();
        var currentDate = clock.TenantNow;

        var couriers = await Context.TucCouriers
            .Where(courier => courier.UccrChannelId == channelId &&
                              courier.CourierGps != null &&
                              courier.CourierLogInOut.LogInTime <= currentDate &&
                              courier.CourierLogInOut.LogOutTime == null &&
                              courier.TucJobUcjbCouriers.Any(job => !job.UcjbJobDone && !job.UcjbVoid &&
                                                                    postcodes.Contains(job.DeliveryAddressLine7)))
            .Select(courier => new EnvelopeCoordinate
            {
                Longitude = (decimal)courier.CourierGps.Longitude,
                Latitude = (decimal)courier.CourierGps.Latitude
            })
            .ToListAsync();

        var unassignedJobs = await Context.TucJobs
            .Where(job => !job.UcjbJobDone && !job.UcjbVoid && job.UcjbCourierId == null &&
                          postcodes.Contains(job.DeliveryAddressLine7))
            .Select(job => new EnvelopeCoordinate
            {
                Longitude = (decimal)job.DeliveryLongitude,
                Latitude = (decimal)job.DeliveryLatitude
            })
            .ToListAsync();

        return [.. couriers, .. unassignedJobs];
    }

    /// <summary>
    /// Gets the polygon GPS coordinates for a NZ clear list area.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetAreaPolygonsQueryNz(int clearListAreaId) =>
        Context.TblClearListAreas
            .Where(cla => cla.ClearListAreaId == clearListAreaId)
            .SelectMany(cla => cla.TblClearListAreaPolygons
                .SelectMany(clap => clap.Polygon.TblPolygonGps
                    .Select(polygonGp => new EnvelopeCoordinate
                    {
                        Longitude = polygonGp.Longitude,
                        Latitude = polygonGp.Latitude
                    })));

    /// <summary>
    /// Gets GPS coordinates of logged-in couriers with active jobs in the NZ clear list area.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetCourierLocationsQueryNz(int clearListAreaId)
    {
        var today = clock.TenantToday;
        return Context.TucCouriers
            .Where(c => c.CourierLogInOut.LogInTime.Date == today &&
                        c.CourierLogInOut.LogOutTime == null)
            .SelectMany(c => c.TucJobUcjbCouriers
                .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid)
                .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                    .SelectMany(dps => dps.Polygon.TblClearListAreaPolygons
                        .Where(areaPolygon => areaPolygon.ClearListArea.ClearListAreaId == clearListAreaId && 
                                        areaPolygon.ClearListArea.ChannelId == c.UccrChannelId)
                        .Select(areaPolygon => new EnvelopeCoordinate
                        {
                            Longitude = (decimal)c.CourierGps.Longitude,
                            Latitude = (decimal)c.CourierGps.Latitude
                        }))));
    }

    /// <summary>
    /// Gets delivery coordinates of unassigned jobs in the NZ clear list area.
    /// </summary>
    private IQueryable<EnvelopeCoordinate> GetUnassignedJobLocationsQueryNz(int clearListAreaId) =>
        Context.TucJobs
            .Where(jt => !jt.UcjbJobDone && !jt.UcjbVoid && jt.UcjbCourierId == null)
            .SelectMany(jt => jt.UcjbToNavigation.TblPolygonSuburbs
                .SelectMany(ps => ps.Polygon.TblClearListAreaPolygons
                    .Where(clap => clap.ClearListAreaId == clearListAreaId)
                    .Select(clap => new EnvelopeCoordinate
                    {
                        Longitude = (decimal)jt.DeliveryLongitude,
                        Latitude = (decimal)jt.DeliveryLatitude
                    })));

    /// <summary>
    /// Calculates the min/max bounding envelope from a set of coordinates.
    /// </summary>
    private static async Task<ClearListEnvelopeViewModel> CalculateEnvelopeAsync(
        IQueryable<EnvelopeCoordinate> query) =>
        await query
            .GroupBy(_ => 1)
            .Select(g => new ClearListEnvelopeViewModel
            {
                MinimumLongitude = g.Min(x => x.Longitude),
                MinimumLatitude = g.Min(x => x.Latitude),
                MaximumLongitude = g.Max(x => x.Longitude),
                MaximumLatitude = g.Max(x => x.Latitude)
            })
            .FirstOrDefaultAsync() ?? new ClearListEnvelopeViewModel();
}