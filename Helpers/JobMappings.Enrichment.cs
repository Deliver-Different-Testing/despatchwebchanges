using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
    #region Job Enrichment Methods

    /// <summary>
    /// Enriches live jobs with collections (flight info for child jobs only).
    /// Pricing, parcels, and flags are now loaded inline via navigation properties.
    /// Also calculates distance for flight jobs.
    /// </summary>
    public static async Task EnrichJobsWithCollectionsAsync(
        List<JobViewModel> jobs,
        IDbContextFactory<DespatchContext> contextFactory,
        ITenantInfoService infoService)
    {
        if (jobs.Count == 0) return;

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);

        // Apply timezone conversion to flight times for root jobs (loaded inline)
        ApplyFlightTimezonesToInlineLoadedJobs(jobs);

        // Calculate distance for flight jobs (moved from expression to enrichment)
        CalculateFlightDistances(jobs);

        ApplyTimezoneToJobDates(jobs, infoService.GetTenantTimeZone());
    }

    /// <summary>
    /// Enriches archived jobs with collections (flight info for child jobs only).
    /// Pricing, parcels, and flags are now loaded inline via navigation properties.
    /// Also calculates distance for flight jobs.
    /// </summary>
    public static async Task EnrichArchivedJobsWithCollectionsAsync(
        List<JobViewModel> jobs,
        IDbContextFactory<DespatchContext> contextFactory,
        ITenantInfoService infoService)
    {
        if (jobs.Count == 0) return;

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);

        // Apply timezone conversion to flight times for root jobs (loaded inline)
        ApplyFlightTimezonesToInlineLoadedJobs(jobs);

        // Calculate distance for flight jobs (moved from expression to enrichment)
        CalculateFlightDistances(jobs);

        ApplyTimezoneToJobDates(jobs, infoService.GetTenantTimeZone());
    }

    /// <summary>
    /// Calculates distance for flight jobs using the Haversine formula.
    /// This is moved from the expression tree to enrichment to prevent client-side evaluation.
    /// </summary>
    private static void CalculateFlightDistances(List<JobViewModel> jobs)
    {
        foreach (var job in jobs.Where(j => j.ToAirportId.HasValue && j.FromAirportId.HasValue && j.Distance == 0))
        {
            // Only calculate if we have valid coordinates
            if (job.PickUpLatitude.HasValue && job.PickUpLongitude.HasValue &&
                job.DeliveryLatitude.HasValue && job.DeliveryLongitude.HasValue)
            {
                job.Distance = DistanceCalculator.CalculateDistance(
                    job.PickUpLatitude.Value,
                    job.PickUpLongitude.Value,
                    job.DeliveryLatitude.Value,
                    job.DeliveryLongitude.Value
                );
            }
        }
    }

    /// <summary>
    /// Applies timezone conversion to flight times for jobs that had flight info loaded inline.
    /// BatchLoadFlightInfoAsync handles timezone conversion for batch-loaded jobs.
    /// </summary>
    private static void ApplyFlightTimezonesToInlineLoadedJobs(List<JobViewModel> jobs)
    {
        // Only process jobs that already have flight data (loaded inline) and weren't batch processed
        var inlineLoadedFlightJobs = jobs
            .Where(j => j.IsFlightAssigned && j.AssignedFlight?.FlightSegments?.Count > 0 && j.ParentId == null)
            .ToList();

        foreach (var flight in inlineLoadedFlightJobs.Select(job => job.AssignedFlight!))
        {
            // Convert segment times
            foreach (var segment in flight.FlightSegments)
            {
                segment.DepartureTime =
                    ConvertUtcToTimeZone(segment.DepartureTime.UtcDateTime, segment.DepartureAirportTimeZone);
                segment.ArrivalTime =
                    ConvertUtcToTimeZone(segment.ArrivalTime.UtcDateTime, segment.ArrivalAirportTimeZone);
            }

            // Update top-level times from converted segments
            var firstSegment = flight.FlightSegments[0];
            var lastSegment = flight.FlightSegments[^1];
            flight.ExpectedDeparture = firstSegment.DepartureTime;
            flight.ExpectedArrival = lastSegment.ArrivalTime;
        }
    }

    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        // Tenant-local datetimes are displayed as-is from the database.
        // No timezone offset stamping needed — the frontend's parseDateFromApi
        // extracts the time value from the ISO string regardless of offset.
    }

    private static async Task BatchLoadFlightInfoAsync(
        DespatchContext context,
        List<JobViewModel> jobs)
    {
        var flightJobsNeedingData = jobs
            .Where(j => j.IsFlightJob && !j.IsFlightAssigned)
            .ToList();
        if (flightJobsNeedingData.Count == 0) return;

        // Get effective job IDs (use ParentId for child jobs, own I'd for root/archived jobs)
        var effectiveJobIds = flightJobsNeedingData
            .Select(j => j.ParentId ?? j.Id)
            .Distinct()
            .ToList();

        // Query TucJobNationwide directly by job ID - works for both live and archived jobs
        var segmentsByJob = await context.TucJobNationwides
            .Where(n => n.UcnwJobId.HasValue && effectiveJobIds.Contains(n.UcnwJobId.Value))
            .Include(n => n.DepartureAirportTimeZoneNavigation)
            .Include(n => n.ArrivalAirportTimeZoneNavigation)
            .OrderBy(n => n.UcnwJobId)
            .ThenBy(n => n.UcnwLegNumber)
            .TagWith("BatchLoadFlightInfo - Flight Segments")
            .ToListAsync();

        var segmentsGroupedByJob = segmentsByJob
            .GroupBy(n => n.UcnwJobId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var job in flightJobsNeedingData)
        {
            var effectiveJobId = job.ParentId ?? job.Id;
            if (!segmentsGroupedByJob.TryGetValue(effectiveJobId, out var segments) || segments.Count == 0)
                continue;

            var departureTimeZone = segments[0].DepartureAirportTimeZoneNavigation?.Name
                                    ?? segments[0].DepartureAirportTimeZone;
            var arrivalTimeZone = segments[^1].ArrivalAirportTimeZoneNavigation?.Name
                                  ?? segments[^1].ArrivalAirportTimeZone;

            var flightSegments = segments.Select(segment =>
            {
                var segmentDepartureTimeZone = segment.DepartureAirportTimeZoneNavigation?.Name
                                               ?? segment.DepartureAirportTimeZone;
                var segmentArrivalTimeZone = segment.ArrivalAirportTimeZoneNavigation?.Name
                                             ?? segment.ArrivalAirportTimeZone;

                return new FlightSegmentViewModel
                {
                    SegmentOrder = segment.UcnwLegNumber - 1,
                    CarrierFsCode = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length >= 2
                        ? segment.UcnwFlightNo[..2]
                        : "??",
                    FlightNumber = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length > 2
                        ? segment.UcnwFlightNo[2..]
                        : "????",
                    DepartureTime = ConvertUtcToTimeZone(segment.UcnwEtd, segmentDepartureTimeZone),
                    ArrivalTime = ConvertUtcToTimeZone(segment.UcnwEta, segmentArrivalTimeZone),
                    DepartureAirportFsCode = segment.DepartureAirportFsCode,
                    DepartureAirportName = segment.DepartureAirportName,
                    DepartureAirportCity = segment.DepartureAirportCity,
                    DepartureAirportCountry = segment.DepartureAirportCountry,
                    DepartureAirportTimeZone = segmentDepartureTimeZone,
                    DepartureAirportTimeZoneId = segment.DepartureAirportTimeZoneId ?? 0,
                    DepartureTerminal = segment.DepartureTerminal,
                    ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                    ArrivalAirportName = segment.ArrivalAirportName,
                    ArrivalAirportCity = segment.ArrivalAirportCity,
                    ArrivalAirportCountry = segment.ArrivalAirportCountry,
                    ArrivalAirportTimeZone = segmentArrivalTimeZone,
                    ArrivalAirportTimeZoneId = segment.ArrivalAirportTimeZoneId ?? 0,
                    ArrivalTerminal = segment.ArrivalTerminal,
                    ElapsedTime = segment.UcnwEta.HasValue && segment.UcnwEtd.HasValue
                        ? (int)(segment.UcnwEta.Value - segment.UcnwEtd.Value).TotalMinutes
                        : 0,
                    AircraftName = segment.AircraftName,
                    AirlineName = segment.UcnwAirlineName
                };
            }).ToList();

            var firstSegment = flightSegments[0];
            var lastSegment = flightSegments[^1];

            job.AssignedFlight = new AssignedFlight
            {
                ExpectedArrival = lastSegment.ArrivalTime,
                ArrivalTimeZone = arrivalTimeZone,
                ExpectedDeparture = firstSegment.DepartureTime,
                DepartureTimeZone = departureTimeZone,
                FlightNumber = firstSegment.CarrierFsCode + firstSegment.FlightNumber,
                Notes = segments[0].UcnwNotes,
                FlightSegments = flightSegments
            };
            job.IsFlightAssigned = true;
        }
    }

    private static DateTimeOffset ConvertUtcToTimeZone(DateTime? utcDateTime, string timeZoneId) =>
        !utcDateTime.HasValue ? SqlMinDateTime : ConvertUtcToTimeZone(utcDateTime.Value, timeZoneId);

    private static DateTimeOffset ConvertUtcToTimeZone(DateTime utcDateTime, string timeZoneId) =>
        string.IsNullOrEmpty(timeZoneId)
            ? new DateTimeOffset(utcDateTime, TimeSpan.Zero)
            : utcDateTime.ToTimeZoneOffset(timeZoneId);

    #endregion
}
