using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
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
        if (jobs.Count == 0)
        {
            return;
        }

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);
        
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
        if (jobs.Count == 0)
        {
            return;
        }

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);

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

    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        if (string.IsNullOrEmpty(tenantTimeZone))
        {
            return;
        }

        var timeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone);
        foreach (var job in jobs.Where(job => job.CreatedDate.HasValue))
        {
            job.CreatedDate = TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(job.CreatedDate!.Value, DateTimeKind.Utc),
                timeZoneInfo);
        }
    }

    private static async Task BatchLoadFlightInfoAsync(
        DespatchContext context,
        List<JobViewModel> jobs)
    {
        var flightJobsNeedingData = jobs
            .Where(j => j.IsFlightJob && !j.IsFlightAssigned)
            .ToList();
        if (flightJobsNeedingData.Count == 0)
        {
            return;
        }

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
            {
                continue;
            }

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
                    DepartureTime = TimeZoneHelper.SetDateTimeWithTimeZone(
                        segment.UcnwEtd ?? throw new NullReferenceException(), segmentDepartureTimeZone),
                    ArrivalTime = TimeZoneHelper.SetDateTimeWithTimeZone(
                        segment.UcnwEta ?? throw new NullReferenceException(), segmentArrivalTimeZone),
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
                        ? (int)(TimeZoneHelper.SetDateTimeWithTimeZone(segment.UcnwEta.Value, segmentArrivalTimeZone)
                            - TimeZoneHelper.SetDateTimeWithTimeZone(segment.UcnwEtd.Value, segmentDepartureTimeZone)).TotalMinutes
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
}
