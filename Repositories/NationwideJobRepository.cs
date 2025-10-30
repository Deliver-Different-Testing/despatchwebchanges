using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Repositories;

public class NationwideJobRepository(
    IDbContextFactory<DespatchContext> contextFactory,
    ITenantInfoService infoService,
    IClearListEnvelopeService clearListEnvelopeService)
    : BaseJobRepository(contextFactory, infoService, clearListEnvelopeService), INationwideJobRepository
{
    private readonly ITenantInfoService _infoService = infoService;

  public async Task AddJobNationwideAsync(AssignFlightToJobRequest requestData,
        List<string> webhookIds)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(requestData.JobId);
            ArgumentNullException.ThrowIfNull(webhookIds);

            if (requestData.FlightSegments.Count == 0)
            {
                Log.Error("No flight segments found for JobId: {JobId}", requestData.JobId);
                return;
            }

            var isUsCustomer = _infoService.IsUsTenant();
            
            // Get the primary flight (first leg)
            var primaryFlight = requestData.FlightSegments.OrderBy(f => f.SegmentOrder).First();
            var primaryFlightNumber = primaryFlight.FlightNumber;
            
            Log.Information("Starting AddJobNationwideAsync for JobId: {JobId}, PrimaryFlight: {PrimaryFlightNumber}, TotalSegments: {SegmentCount}",
                requestData.JobId, primaryFlightNumber, requestData.FlightSegments.Count);
            
            var lastFlight = requestData.FlightSegments.OrderBy(f => f.SegmentOrder).Last();
            ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.CarrierFsCode);
            ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.FlightNumber);

            Log.Debug("Fetching job details for JobId: {JobId}, PrimaryFlight: {PrimaryFlightNumber}",
                requestData.JobId, primaryFlightNumber);

            var job = await Context.TucJobs
                .Include(j => j.Parent)
                .ThenInclude(j => j.InverseParent)
                .ThenInclude(j => j.UcjbSpeedNavigation)
                .ThenInclude(jt => jt.Grouping)
                .Where(j => j.UcjbId == requestData.JobId)
                .FirstOrDefaultAsync();
            
            var timeZones = await Context.TimeZones.ToListAsync();

            ArgumentNullException.ThrowIfNull(job);
            
            Log.Information("Job {JobNumber} retrieved for PrimaryFlight: {PrimaryFlightNumber}, ClientId: {ClientId}",
                job.UcjbNumber, primaryFlightNumber, job.UcjbClientId);

            var firstFlightDepartureTimeZoneId = GetTimeZoneIdFromList(timeZones, primaryFlight.DepartureAirportTimeZone);
            var lastFlightArrivalTimeZoneId = GetTimeZoneIdFromList(timeZones, lastFlight.ArrivalAirportTimeZone);

            var airports = await GetAirportAddressInfosAsync();
            
            Log.Debug("Creating TucJobNationwide record for PrimaryFlight: {PrimaryFlightNumber}, Route: {DepartureAirport} -> {ArrivalAirport}",
                primaryFlightNumber, primaryFlight.DepartureAirportFsCode, primaryFlight.ArrivalAirportFsCode);
            
            // Create the main flight record
            var jobNationwide = new TucJobNationwide
            {
                UcnwJobId = job.UcjbId,
                UcnwJobNumber = job.UcjbNumber,
                UcnwClientId = job.UcjbClientId ?? 0,
                UcnwFlightNo = primaryFlight.CarrierFsCode + primaryFlight.FlightNumber,
                UcnwEtd = primaryFlight.DepartureTime.DateTime,
                UcnwEta = primaryFlight.ArrivalTime.DateTime,
                WebhookAlertId = webhookIds.First(),
                GateNumber = primaryFlight.DepartureTerminal,
                UcnwLegNumber = 1,
                UcnwAirlineName = primaryFlight.AirlineName,
                CarrierFsCode = primaryFlight.CarrierFsCode,
                DepartureAirportFsCode = primaryFlight.DepartureAirportFsCode,
                DepartureAirportName = primaryFlight.DepartureAirportName,
                DepartureAirportCity = primaryFlight.DepartureAirportCity,
                DepartureAirportCountry = primaryFlight.DepartureAirportCountry,
                DepartureAirportTimeZone = primaryFlight.DepartureAirportTimeZone,
                DepartureAirportTimeZoneId = firstFlightDepartureTimeZoneId,
                ArrivalAirportFsCode = primaryFlight.ArrivalAirportFsCode,
                ArrivalAirportName = primaryFlight.ArrivalAirportName,
                ArrivalAirportCity = primaryFlight.ArrivalAirportCity,
                ArrivalAirportCountry = primaryFlight.ArrivalAirportCountry,
                ArrivalAirportTimeZone = primaryFlight.ArrivalAirportTimeZone,
                ArrivalAirportTimeZoneId = GetTimeZoneIdFromList(timeZones, primaryFlight.ArrivalAirportTimeZone),
                DepartureTerminal = primaryFlight.DepartureTerminal,
                ArrivalTerminal = primaryFlight.ArrivalTerminal,
                AircraftName = primaryFlight.AircraftName
            };

            // Update job status and properties
            Log.Debug("Updating job status for PrimaryFlight: {PrimaryFlightNumber}, OldStatus: {OldStatus}, NewStatus: {NewStatus}",
                primaryFlightNumber, job.UcjbStatus, (int)JobStatus.Dispatched);
            
            job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
            job.UcjbStatus = (int)JobStatus.Dispatched;

            job.UcjbDate = primaryFlight.DepartureTime.DateTime;
            job.UcjbTime = primaryFlight.DepartureTime.DateTime;

            var departureAirportId = requestData.FromAirportId ?? job.FromAirportId;
            ArgumentNullException.ThrowIfNull(departureAirportId);
            var arrivalAirportId = requestData.ToAirportId ?? job.ToAirportId;
            ArgumentNullException.ThrowIfNull(arrivalAirportId);

            Log.Debug("Processing airports for PrimaryFlight: {PrimaryFlightNumber}, DepartureAirportId: {DepartureAirportId}, ArrivalAirportId: {ArrivalAirportId}",
                primaryFlightNumber, departureAirportId, arrivalAirportId);

            // Set Pickup Job Deliver By
            if (job.FromAirportId != null || requestData.FromAirportId != null)
            {
                var pickUpJob = job.Parent.InverseParent.FirstOrDefault(j =>
                    j.UcjbNumber.EndsWith('1') &&
                    j.UcjbSpeedNavigation?.Grouping?.GroupingId == (isUsCustomer
                        ? (int)SpeedGrouping.Agent
                        : (int)UrgentSpeedGrouping.NationwideAgent));

                if (pickUpJob != null)
                {
                    Log.Information("Updating pickup job {PickupJobNumber} for PrimaryFlight: {PrimaryFlightNumber}",
                        pickUpJob.UcjbNumber, primaryFlightNumber);
                    
                    var airportProcessingTime = await GetAirportProcessingTimeAsync(departureAirportId.Value);
                    pickUpJob.DeliverByTime = primaryFlight.DepartureTime.AddMinutes(-airportProcessingTime).DateTime;
                    pickUpJob.DeliverByTimeZoneId = firstFlightDepartureTimeZoneId;

                    // Update delivery address with airport
                    UpdateJobAddressWithAirportInfo(airports, pickUpJob, departureAirportId.Value,
                        firstFlightDepartureTimeZoneId, true);
                }
                else
                {
                    Log.Warning("No pickup job found for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                        primaryFlightNumber, requestData.JobId);
                }
            }

            // Second part
            job.DeliverByTime = lastFlight.ArrivalTime.DateTime;
            UpdateJobAddressWithAirportInfo(airports, job, departureAirportId.Value,
                firstFlightDepartureTimeZoneId, false);
            UpdateJobAddressWithAirportInfo(airports, job, arrivalAirportId.Value,
                lastFlightArrivalTimeZoneId, true);

            // Set delivery job pick-up time
            if (job.ToAirportId != null || requestData.ToAirportId != null)
            {
                var deliveryJob = job.Parent.InverseParent.FirstOrDefault(j => (j.UcjbNumber.EndsWith('2')
                                                                                   || j.UcjbNumber.EndsWith('3'))
                                                                               && j.UcjbSpeedNavigation?.Grouping
                                                                                   ?.GroupingId ==
                                                                               (isUsCustomer
                                                                                   ? (int)SpeedGrouping.Agent
                                                                                   : (int)UrgentSpeedGrouping
                                                                                       .NationwideAgent));

                if (deliveryJob != null)
                {
                    Log.Information("Updating delivery job {DeliveryJobNumber} for PrimaryFlight: {PrimaryFlightNumber}",
                        deliveryJob.UcjbNumber, primaryFlightNumber);
                    
                    var airportProcessingTime = await GetAirportProcessingTimeAsync(arrivalAirportId.Value);

                    var packageReadyTime = requestData.PackageReadyTime ??
                                           lastFlight.ArrivalTime.AddMinutes(airportProcessingTime);
                    deliveryJob.UcjbDate = packageReadyTime.Date;
                    deliveryJob.UcjbTime = packageReadyTime.DateTime;
                    deliveryJob.DeliverByTime = deliveryJob.DeliverByTime ??= requestData.PackageDeliverByTime?.DateTime;
                    deliveryJob.DeliverByTimeZoneId = lastFlightArrivalTimeZoneId;
                    deliveryJob.DeliverByTimeZoneId = lastFlightArrivalTimeZoneId;

                    // Set parent deliver by time too
                    job.Parent.DeliverByTime = job.Parent.DeliverByTime ??= requestData.PackageDeliverByTime?.DateTime;

                    // Update Pickup Address With Airport
                    UpdateJobAddressWithAirportInfo(airports, deliveryJob, arrivalAirportId.Value,
                        lastFlightArrivalTimeZoneId,false);

                    // Add notes for agents if any added
                    if (!string.IsNullOrEmpty(requestData.PackageDeliveryNotes))
                    {
                        Log.Debug("Adding delivery notes for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                            primaryFlightNumber, requestData.JobId);
                        
                        await SaveNoteAsync(requestData.JobId, requestData.PackageDeliveryNotes, true, false,
                            NoteType.DeliveryNotes);
                    }
                }
                else
                {
                    Log.Warning("No delivery job found for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                        primaryFlightNumber, requestData.JobId);
                }
            }

            var currentTime = _infoService.GetCurrentTenantTime();
            job.UcjbDispDate = currentTime;
            job.UcjbDispTime = currentTime;

            Log.Information("Adding main flight record for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                primaryFlightNumber, requestData.JobId);

            // Add the main flight record
            await Context.AddAsync(jobNationwide);

            // Add additional flight legs if there is multiple
            if (requestData.FlightSegments.Count > 1)
            {
                Log.Information("Processing {ConnectionCount} connection flights for PrimaryFlight: {PrimaryFlightNumber}",
                    requestData.FlightSegments.Count - 1, primaryFlightNumber);
                
                for (var i = 1; i < requestData.FlightSegments.Count; i++)
                {
                    var leg = requestData.FlightSegments[i];
                    
                    Log.Debug("Adding connection leg {LegNumber} for PrimaryFlight: {PrimaryFlightNumber}, Flight: {ConnectionFlight}",
                        i + 1, primaryFlightNumber, leg.FlightNumber);
                    
                    var connectionSegment = new TucJobNationwide
                    {
                        UcnwJobId = job.UcjbId,
                        UcnwJobNumber = job.UcjbNumber,
                        UcnwClientId = job.UcjbClientId ?? 0,
                        UcnwFlightNo = leg.CarrierFsCode + leg.FlightNumber,
                        UcnwEtd = leg.DepartureTime.DateTime,
                        UcnwEta = leg.ArrivalTime.DateTime,
                        WebhookAlertId = webhookIds[i],
                        UcnwLegNumber = i + 1,
                        UcnwAirlineName = leg.AirlineName,
                        CarrierFsCode = leg.CarrierFsCode,
                        DepartureAirportFsCode = leg.DepartureAirportFsCode,
                        DepartureAirportName = leg.DepartureAirportName,
                        DepartureAirportCity = leg.DepartureAirportCity,
                        DepartureAirportCountry = leg.DepartureAirportCountry,
                        DepartureAirportTimeZone = leg.DepartureAirportTimeZone,
                        DepartureAirportTimeZoneId = GetTimeZoneIdFromList(timeZones, leg.DepartureAirportTimeZone),
                        ArrivalAirportFsCode = leg.ArrivalAirportFsCode,
                        ArrivalAirportName = leg.ArrivalAirportName,
                        ArrivalAirportCity = leg.ArrivalAirportCity,
                        ArrivalAirportCountry = leg.ArrivalAirportCountry,
                        ArrivalAirportTimeZone = leg.ArrivalAirportTimeZone,
                        ArrivalAirportTimeZoneId = GetTimeZoneIdFromList(timeZones, leg.ArrivalAirportTimeZone),
                        DepartureTerminal = leg.DepartureTerminal,
                        ArrivalTerminal = leg.ArrivalTerminal,
                        AircraftName = leg.AircraftName
                    };

                    await Context.AddAsync(connectionSegment);
                }
            }

            await SaveNoteAsync(requestData.JobId,
                $"Flight {requestData.FlightSegments[0]?.FlightNumber} added to job {requestData.JobId}",
                false,
                false,
                NoteType.FlightUpdate);

            Log.Debug("Saving changes for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}",
                primaryFlightNumber, requestData.JobId);

            await Context.SaveChangesAsync();

            var journeyRecord = new JobDeliveryJourney
            {
                JobId = requestData.JobId,
                FlightId = jobNationwide.UcnwId,
                ChangeType = nameof(DeliveryJourneyChangeType.FlightAssignment),
                StaffId = _infoService.GetStaffId(),
                UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff)
            };
            await Context.AddAsync(journeyRecord);

            // Final save for the journey record
            await Context.SaveChangesAsync();
            
            Log.Information("Successfully completed AddJobNationwideAsync for PrimaryFlight: {PrimaryFlightNumber}, JobId: {JobId}, FlightId: {FlightId}",
                primaryFlightNumber, requestData.JobId, jobNationwide.UcnwId);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured adding PrimaryFlight: {PrimaryFlightNumber} to job {JobId}",
                requestData.FlightSegments[0]?.FlightNumber,
                requestData.JobId);
            throw;
        }
    }

    private static int? GetTimeZoneIdFromList(List<TimeZone> timeZones, string timeZoneName)
    {
        return timeZones
            .Where(tz => tz.Name == timeZoneName || tz.Code == timeZoneName)
            .Select(tz => tz.Id)
            .FirstOrDefault();
    }

    private async Task<List<AirportAddressInfoDto>> GetAirportAddressInfosAsync()
    {
        var airports = await Context.TblAirports
            .Where(a => a.Active)
            .Select(a => new AirportAddressInfoDto
            {
                AirportId = a.AirportId,
                AddressLine1 = a.AddressLine1,
                AddressLine2 = a.AddressLine2,
                AddressLine3 = a.AddressLine3,
                AddressLine4 = a.AddressLine4,
                AddressLine5 = a.AddressLine5,
                AddressLine6 = a.AddressLine6,
                AddressLine7 = a.AddressLine7,
                AddressLine8 = a.AddressLine8,
                Latitude = a.Latitude,
                Longitude = a.Longitude
            })
            .AsNoTracking()
            .ToListAsync();

        return airports;
    } 

    public async Task<List<AirportSuggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true)
    {
        const double maxDistanceMiles = 500;

        var jobAndAirports = await (
                from job in Context.TucJobs
                where job.UcjbId == jobId &&
                      (usePickup
                          ? job.PickUpLatitude != null && job.PickUpLongitude != null
                          : job.DeliveryLatitude != null && job.DeliveryLongitude != null)
                join airport in Context.TblAirports on 1 equals 1
                where airport.Active && airport.Latitude != null && airport.Longitude != null
                select new
                {
                    JobLatitude = usePickup ? job.PickUpLatitude.Value : job.DeliveryLatitude.Value,
                    JobLongitude = usePickup ? job.PickUpLongitude.Value : job.DeliveryLongitude.Value,
                    airport.AirportId,
                    airport.Name,
                    AirportLatitude = airport.Latitude.Value,
                    AirportLongitude = airport.Longitude.Value,
                    TimeZone = airport.Timezone
                })
            .AsNoTracking()
            .ToListAsync();

        // Return an empty list if no valid job found
        if (jobAndAirports.Count == 0) return [];

        // Extract job coordinates from the first result (all have the same job coordinates)
        var jobLatitude = jobAndAirports.First().JobLatitude;
        var jobLongitude = jobAndAirports.First().JobLongitude;

        // Calculate distances, filter and sort
        return jobAndAirports
            .Select(item => new
            {
                item.AirportId,
                item.Name,
                Distance = DistanceCalculator.CalculateDistance(
                    jobLatitude,
                    jobLongitude,
                    item.AirportLatitude,
                    item.AirportLongitude),
                Timezone = item.TimeZone
            })
            .Where(result => result.Distance <= maxDistanceMiles)
            .OrderBy(result => result.Distance)
            .Select(result => new AirportSuggestion
            {
                Id = result.AirportId,
                Text = $"{result.Name} ({result.Distance} mi)",
                Timezone = result.Timezone
            })
            .ToList();
    }

    public async Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId)
    {
        var airportCodes = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new
            {
                ToAirport = j.ToAirport.AirportCode,
                FromAirport = j.FromAirport.AirportCode
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return (airportCodes?.ToAirport, airportCodes?.FromAirport);
    }

    public async Task<List<AgentViewModel>> GetAgentsAsync(int jobId)
    {
        var job = await GetJobDetailsAsync(jobId);
        ArgumentNullException.ThrowIfNull(job);

        Log.Information(
            "Job details retrieved for {JobId}: AirportId={AirportId}, VehicleSizeId={VehicleSizeId}",
            jobId, job.AirPortId, job.VehicleSizeId);

        var agents = await GetEligibleAgentsAsync(job.AirPortId, job.VehicleSizeId);
        Log.Information("Found {AgentCount} eligible agents for job {JobId}",
            agents?.Count ?? 0, jobId);

        var results = await ProcessAgentsInParallelAsync(job, agents);
        Log.Information("Processed {ResultCount} agents with rates for job {JobId}",
            results?.Count ?? 0, jobId);

        return results;
    }

    public async Task AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false)
    {
        var job = await Context.TucJobs
            .Include(j => j.Parent)
            .ThenInclude(j => j.InverseParent)
            .Include(j => j.InverseParent)
            .FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        var currentDate = _infoService.GetCurrentTenantTime();
        var isDepartureAirportAgent = job.FromAirportId != null && job.ToAirportId == null;
        var isGroundJob = !string.IsNullOrEmpty(job.UcjbNumber) && !char.IsDigit(job.UcjbNumber.Last());

        job.AgentId = agentId;
        job.UcjbStatus = isGroundJob ? (int)JobStatus.GroundAgentAssigned
            : isDepartureAirportAgent ? (int)JobStatus.InboundAgentAssigned
            : (int)JobStatus.OutboundAgentAssigned;

        job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
        job.UcjbDispDate = currentDate;
        job.UcjbDispTime = currentDate;

        // Get Agent Name
        var agentName = await GetAgentNameAsync(agentId);

        if (includeStopJobs)
        {
            var mainJobNumber = job.UcjbNumber;
            ArgumentException.ThrowIfNullOrEmpty(mainJobNumber);

            // Stop jobs have the pattern: mainJobNumber + letter (e.g., KT22451a, KT22451b, KT22451c)
            var stopJobs = job.Parent != null
                ? job.Parent.InverseParent.Where(j =>
                    !string.IsNullOrEmpty(j.UcjbNumber) &&
                    j.UcjbNumber.StartsWith(mainJobNumber) &&
                    j.UcjbNumber.Length == mainJobNumber.Length + 1 &&
                    char.IsLetter(j.UcjbNumber.Last()) &&
                    j.UcjbId != jobId) // Exclude the main job itself
                : job.InverseParent.Where(j =>
                    !string.IsNullOrEmpty(j.UcjbNumber) &&
                    j.UcjbNumber.StartsWith(mainJobNumber) &&
                    j.UcjbNumber.Length == mainJobNumber.Length + 1 &&
                    char.IsLetter(j.UcjbNumber.Last()) &&
                    j.UcjbId != jobId); // Exclude the main job itself

            foreach (var stopJob in stopJobs)
            {
                stopJob.AgentId = agentId;
                stopJob.UcjbStatus = isGroundJob ? (int)JobStatus.GroundAgentAssigned
                    : isDepartureAirportAgent ? (int)JobStatus.InboundAgentAssigned
                    : (int)JobStatus.OutboundAgentAssigned;
                stopJob.UcjbDispDate = currentDate;
                stopJob.UcjbDispTime = currentDate;

                var stopJobNote = new TucNote
                {
                    JobId = stopJob.UcjbId,
                    NoteTypeId = (int)NoteType.AgentUpdate,
                    NoteText = $"Agent {agentName} assigned",
                    CreatedBy = _infoService.GetStaffId(),
                    CreatedDate = currentDate
                };

                await Context.AddAsync(stopJobNote);
            }
        }

        await Context.SaveChangesAsync();

        // Note Record
        var note = new TucNote
        {
            JobId = jobId,
            NoteTypeId = (int)NoteType.AgentUpdate,
            NoteText = $"Agent {agentName} assigned",
            CreatedBy = _infoService.GetStaffId(),
            CreatedDate = currentDate
        };
        await Context.TucNotes.AddAsync(note);
        await Context.SaveChangesAsync();

        var journeyRecord = new JobDeliveryJourney
        {
            JobId = jobId,
            NewAgentId = agentId,
            ChangeType = nameof(DeliveryJourneyChangeType.AgentAssignment),
            StaffId = _infoService.GetStaffId(),
            UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff)
        };

        await Context.AddAsync(journeyRecord);
        await Context.SaveChangesAsync();
    }

    public async Task<JobSearchResult> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant,
        string clientIds, NationwideWidget windowPane,
        List<int> selectedViewIds)
    {
        if (!isInternal && string.IsNullOrEmpty(clientIds))
            return new JobSearchResult 
            { 
                Jobs = [], 
                TotalCount = 0,
                HasMore = false
            };

        return await DespatchQryWithPagination(
            AppPage.Domestic,
            queryParams,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            windowPane);
    }

    private async Task<NationwideJobDetail> GetJobDetailsAsync(int jobId)
    {
        // First check if we need to find a nearby airport
        var airportId = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => j.FromAirportId ?? j.ToAirportId)
            .FirstOrDefaultAsync();

        // If no airport ID found, get the closest one
        if (airportId != null)
            return await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => new NationwideJobDetail
                {
                    AirPortId = airportId,
                    VehicleSizeId = j.UcjbSize,
                    ClientId = j.UcjbClientId,
                    FromZipCode = j.PickupAddressLine7,
                    ToZipCode = j.DeliveryAddressLine7,
                    TotalMiles = 20,
                    TotalWeight = (decimal)j.UcjbWeight,
                    BookTime = new DateTime(
                        j.UcjbDate.Year,
                        j.UcjbDate.Month,
                        j.UcjbDate.Day,
                        j.UcjbTime != null ? j.UcjbTime.Value.Hour : 0,
                        j.UcjbTime != null ? j.UcjbTime.Value.Minute : 0,
                        j.UcjbTime != null ? j.UcjbTime.Value.Second : 0
                    ),
                    DangerousGoods = j.Dgdocument,
                    DryIceWeight = j.DryIceWeight,
                    Quantity = j.UcjbQty,
                    FromState = j.PickupAddressLine5,
                    ToState = j.DeliveryAddressLine5,
                    TotalPallets = null,
                    ExtraStopOffs = true,
                    WaitTime = null,
                    Cubic = null
                })
                .FirstOrDefaultAsync();

        var nearbyAirports = await GetNearbyAirportsAsync(jobId);
        if (nearbyAirports.Count == 0)
            return await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(j => new NationwideJobDetail
                {
                    AirPortId = airportId,
                    VehicleSizeId = j.UcjbSize,
                    ClientId = j.UcjbClientId,
                    FromZipCode = j.PickupAddressLine7,
                    ToZipCode = j.DeliveryAddressLine7,
                    TotalMiles = 20,
                    TotalWeight = (decimal)j.UcjbWeight,
                    BookTime = new DateTime(
                        j.UcjbDate.Year,
                        j.UcjbDate.Month,
                        j.UcjbDate.Day,
                        j.UcjbTime != null ? j.UcjbTime.Value.Hour : 0,
                        j.UcjbTime != null ? j.UcjbTime.Value.Minute : 0,
                        j.UcjbTime != null ? j.UcjbTime.Value.Second : 0
                    ),
                    DangerousGoods = j.Dgdocument,
                    DryIceWeight = j.DryIceWeight,
                    Quantity = j.UcjbQty,
                    FromState = j.PickupAddressLine5,
                    ToState = j.DeliveryAddressLine5,
                    TotalPallets = null,
                    ExtraStopOffs = true,
                    WaitTime = null,
                    Cubic = null
                })
                .FirstOrDefaultAsync();
        airportId = nearbyAirports.First().Id;
        Log.Information("Using nearest airport {AirportId} for job {JobId}", airportId, jobId);

        return await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new NationwideJobDetail
            {
                AirPortId = airportId,
                VehicleSizeId = j.UcjbSize,
                ClientId = j.UcjbClientId,
                FromZipCode = j.PickupAddressLine7,
                ToZipCode = j.DeliveryAddressLine7,
                TotalMiles = 20,
                TotalWeight = (decimal)j.UcjbWeight,
                BookTime = new DateTime(
                    j.UcjbDate.Year,
                    j.UcjbDate.Month,
                    j.UcjbDate.Day,
                    j.UcjbTime != null ? j.UcjbTime.Value.Hour : 0,
                    j.UcjbTime != null ? j.UcjbTime.Value.Minute : 0,
                    j.UcjbTime != null ? j.UcjbTime.Value.Second : 0
                ),
                DangerousGoods = j.Dgdocument,
                DryIceWeight = j.DryIceWeight,
                Quantity = j.UcjbQty,
                FromState = j.PickupAddressLine5,
                ToState = j.DeliveryAddressLine5,
                TotalPallets = null,
                ExtraStopOffs = true,
                WaitTime = null,
                Cubic = null
            })
            .FirstOrDefaultAsync();
    }

    private async Task<List<AgentDto>> GetEligibleAgentsAsync(int? airportId, int? vehicleSizeId)
    {
        return await Context.AgentVehicles
            .Where(av => av.AirportId == airportId && av.VehicleSizeId == vehicleSizeId)
            .Select(a => new AgentDto
            {
                AgentId = a.AgentId.Value,
                AgentName = a.Agent.UcagName,
                AgentRanking = a.Agent.Ranking.AgentRankingName,
                DistanceRateId = a.DistanceRateId
            })
            .ToListAsync();
    }

    private async Task<List<AgentViewModel>> ProcessAgentsInParallelAsync(NationwideJobDetail nationwideJob,
        List<AgentDto> agents)
    {
        const int batchSize = 100;
        var agentResults = new ConcurrentBag<AgentViewModel>();

        await Parallel.ForEachAsync(
            agents.Chunk(batchSize),
            new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
            async (batch, ct) =>
            {
                foreach (var agent in batch)
                {
                    var agentRate = await GetAgentRatesAsync(nationwideJob, agent, ct);
                    var viewModel = new AgentViewModel
                    {
                        AgentId = agent.AgentId,
                        AgentName = agent.AgentName,
                        AgentRanking = agent.AgentRanking,
                        AgentRate = agentRate ?? 0,
                        AgentNotes = agent.AgentNotes
                    };

                    agentResults.Add(viewModel);
                }
            });

        return agentResults.ToList();
    }

    private async Task<decimal?> GetAgentRatesAsync(NationwideJobDetail nationwideJob,
        AgentDto agent, CancellationToken ct)
    {
        var rates = await Context.Procedures.DD_stpGetAgentDistanceRateAsync(
            nationwideJob.ClientId,
            int.Parse(nationwideJob.FromZipCode),
            nationwideJob.FromState,
            int.Parse(nationwideJob.ToZipCode),
            nationwideJob.ToState,
            nationwideJob.TotalMiles,
            nationwideJob.TotalWeight,
            nationwideJob.Quantity,
            nationwideJob.Cubic,
            nationwideJob.TotalPallets,
            nationwideJob.ExtraStopOffs ? 1 : 0,
            nationwideJob.BookTime,
            nationwideJob.VehicleSizeId,
            nationwideJob.DangerousGoods,
            nationwideJob.DryIceWeight,
            nationwideJob.WaitTime,
            agent.DistanceRateId,
            cancellationToken: ct
        );

        return rates
            .Select(r => r.Rate)
            .FirstOrDefault();
    }

    public async Task<List<AirlineSuggestion>> GetActiveAirlineOptionsAsync()
    {
        var airlines = await Context.FlightCarriers
            .Where(fc => fc.IsActive)
            .Select(x => new AirlineSuggestion
            {
                Id = x.FlightCarrierId,
                Text = x.CarrierCode,
                FullAirlineName = x.FlightCarrierName
            })
            .AsNoTracking()
            .ToListAsync();

        return airlines;
    }

    public async Task<List<string>> GetActiveAirlineCodesAsync()
    {
        var airlineCodes = await Context.FlightCarriers
            .Where(fc => fc.IsActive)
            .Select(x => x.CarrierCode)
            .AsNoTracking()
            .ToListAsync();

        return airlineCodes;
    }

    public async Task<string> GetAirlineCodeByIdAsync(int airlineId)
    {
        var airlineCode = await Context.FlightCarriers
            .Where(fc => fc.FlightCarrierId == airlineId)
            .Select(x => x.CarrierCode)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return airlineCode;
    }

    public async Task SendAgentRequestMessageAsync(int agentId, int jobId)
    {
        var agentEmail = await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagFax)
            .FirstOrDefaultAsync();

        var smppSetting = await Context.TblSmppsettings.FirstOrDefaultAsync();

        var staffId = _infoService.GetStaffId();

        // Create an object
        var agentQuoteTemplateDto = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new AgentQuoteTemplateDto
            {
                DeliveryAddressLine5 = j.DeliveryAddressLine5,
                JobNo = j.UcjbNumber,
                ReferenceA = j.UcjbClientRefa,
                ReferenceB = j.UcjbClientRefb,
                JobDate = j.UcjbDate,
                SuburbFrom = j.DeliveryAddressLine6,
                ToAddress = new AddressViewModel(
                    j.DeliveryAddressLine1,
                    j.DeliveryAddressLine2,
                    j.DeliveryAddressLine3,
                    j.DeliveryAddressLine4,
                    j.DeliveryAddressLine5,
                    j.DeliveryAddressLine6,
                    j.DeliveryAddressLine7,
                    j.DeliveryAddressLine8).FullAddress,
                CompletedTime = j.UcjbComplTime,
                PodName = j.UcjbPodname,
                SuburbTo = j.DeliveryAddressLine6
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        agentQuoteTemplateDto.CompletedTimeFormatted =
            _infoService.FormatDateForTenant(agentQuoteTemplateDto.CompletedTime);

        Log.Information("AgentQuoteTemplateDto for job {JobId} and agent {AgentId}: {@AgentQuoteTemplateDto}",
            jobId,
            agentId,
            agentQuoteTemplateDto);
        var subject = FormatDelimMessage(smppSetting.AgentEmailSubject, "[", "]", agentQuoteTemplateDto);
        var body = FormatDelimMessage(smppSetting.AgentEmailMessage, "[", "]", agentQuoteTemplateDto);

        var request = new TucManualMessage
        {
            JobId = jobId,
            Subject = subject,
            ReplyToEmailAddress = smppSetting.AgentEmailReplyAddress,
            UcmmMessage = body,
            UcmmStaffId = staffId,
            SendToEmailAddress = agentEmail
        };

        Context.Add(request);
        await Context.SaveChangesAsync();
    }

    private static string FormatDelimMessage<T>(string format, string startDelim, string endDelim, T data)
    {
        var message = string.Empty;
        while (!string.IsNullOrEmpty(format) && format.Length > 0)
        {
            var c = format[..1];
            format = format[1..];

            if (c == startDelim)
            {
                var endDelimIndex = format.IndexOf(endDelim, StringComparison.Ordinal);
                var fieldName = format[..endDelimIndex];
                format = format[(endDelimIndex + 1)..];

                var props = typeof(T).GetRuntimeProperties();
                var p = props.First(x => string.Equals(x.Name, fieldName, StringComparison.CurrentCultureIgnoreCase));

                message += p.GetValue(data)?.ToString();
            }
            else
            {
                message += c;
            }
        }

        message = message.Replace("  ", " ");
        message = message.Trim();
        return message;
    }

    public async Task RestoreNationwideJobAsync(int jobId)
    {
        // First, verify the job exists
        var jobExists = await Context.TucJobs.AnyAsync(j => j.UcjbId == jobId);
        if (!jobExists)
            throw new ArgumentException($"Job with ID {jobId} not found");

        await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(j => j.UcjbStatus, (int)JobStatus.New)
                .SetProperty(j => j.InternalStatus, (int)InternalJobStatus.NewJobs)
                .SetProperty(j => j.UcjbJobDone, false)
                .SetProperty(j => j.UcjbVoid, false)
                .SetProperty(j => j.UcjbCourierId, (int?)null)
                .SetProperty(j => j.UcjbDispDate, (DateTime?)null)
                .SetProperty(j => j.UcjbDispTime, (DateTime?)null)
                .SetProperty(j => j.UcjbPaged, false)
                .SetProperty(j => j.UcjbPagedTime, (DateTime?)null)
                .SetProperty(j => j.UcjbComplTime, (DateTime?)null)
                .SetProperty(j => j.UcjbMobileSend, false)
                .SetProperty(j => j.AutoDespatch, false)
                .SetProperty(j => j.PickRunOrder, (int?)null)
                .SetProperty(j => j.DropRunOrder, (int?)null)
                .SetProperty(j => j.DesCheck, false)
                .SetProperty(j => j.FdcourierId, (int?)null)
                .SetProperty(j => j.FirstJob, false)
                .SetProperty(j => j.AgentId, (int?)null)
                .SetProperty(j => j.UcjbFlightDetails, string.Empty));

        // Get flight IDs for cascade deletion
        var flightIds = await Context.TucJobNationwides
            .Where(flight => flight.UcnwJobId == jobId)
            .Select(flight => flight.UcnwId)
            .ToListAsync();

        if (flightIds.Count != 0)
        {
            // Delete delivery journeys linked to these flights
            await Context.JobDeliveryJourneys
                .Where(journey => journey.FlightId.HasValue && flightIds.Contains(journey.FlightId.Value))
                .ExecuteDeleteAsync();

            // Delete the flight records
            await Context.TucJobNationwides
                .Where(flight => flight.UcnwJobId == jobId)
                .ExecuteDeleteAsync();
        }

        // Remove read tracker record
        await Context.TucJobReadTrackers
            .Where(tracker => tracker.JobId == jobId)
            .ExecuteDeleteAsync();

        // Make a note of restore
        await SaveNoteAsync(jobId, "Job restored", true);
    }

    public async Task<List<Suggestion>> GetAllAgentOptionsBySearchAsync(string searchTerm)
    {
        var query = Context.TucAgents.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(a => a.UcagName.Contains(searchTerm));
        }

        var agents = await query
            .Select(a => new Suggestion
            {
                Id = a.UcagId,
                Text = a.UcagName
            })
            .OrderBy(a => a.Text)
            .AsNoTracking()
            .ToListAsync();

        return agents;
    }

    public async Task<List<string>> GetFlightWebhookIdByJobIdAsync(int jobId)
    {
        var webhookId = await Context.TucJobNationwides
            .Where(nj => nj.UcnwJobId == jobId)
            .Select(nj => nj.WebhookAlertId)
            .Distinct()
            .AsNoTracking()
            .ToListAsync();

        return webhookId;
    }

    private async Task<int> GetAirportProcessingTimeAsync(int airportId)
    {
        var processingTime = await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .Select(a => a.ProcessingTime)
            .FirstOrDefaultAsync();

        return processingTime ?? 60;
    }

    public async Task<AgentInfoDialogViewModel> GetAgentInfoForDialogAsync(int agentId)
    {
        var agentInfo = await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => new AgentInfoDialogViewModel
            {
                AgentId = a.UcagId,
                AgentEmail = a.UcagFax,
                AgentPhone = a.UcagPhone,
                AgentName = a.UcagName,
                AgentNotes = a.UcagNotes,
                AgentRanking = a.Ranking != null ? a.Ranking.AgentRankingName : string.Empty,
                Address = new AddressViewModel(
                    a.AddressLine1,
                    a.AddressLine2,
                    a.AddressLine3,
                    a.AddressLine4,
                    a.AddressLine5,
                    a.AddressLine6,
                    a.AddressLine7,
                    a.AddressLine8),
                Airports = a.AgentVehicles.Count != 0
                    ? a.AgentVehicles.Select(av => new AirportViewModel
                    {
                        Name = av.Airport.Name,
                        Code = av.Airport.AirportCode,
                        City = av.Airport.AddressLine5,
                        Country = av.Airport.AddressLine8,
                        Latitude = (double)av.Airport.Latitude,
                        Longitude = (double)av.Airport.Longitude,
                        Timezone = av.Airport.Timezone
                    }).ToList()
                    : new List<AirportViewModel>()
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return agentInfo;
    }

    public async Task<bool> IsHolidayAsync(int clientId, DateTime bookTime)
    {
        return await Context.TblHolidays
            .AnyAsync(h => (h.ClientId == clientId || h.ClientId == null) &&
                           (h.SpeedId == null || h.AllSpeeds) &&
                           h.Date.Date == bookTime.Date &&
                           bookTime.TimeOfDay >= h.StartTime.TimeOfDay && bookTime.TimeOfDay <= h.EndTime.TimeOfDay &&
                           h.JobEntryType == "Local" &&
                           h.CanBook);
    }

    public async Task<bool> IsAfterHoursAsync(int clientId, DateTime bookTime, bool isHoliday)
    {
        if (isHoliday)
            return false;

        var dayName = bookTime.DayOfWeek.ToString();
        return await Context.TblAfterHours
            .AnyAsync(a => (a.ClientId == clientId || a.ClientId == null) &&
                           (a.SpeedId == null || a.AllSpeeds) &&
                           a.JobEntryType == "Local" &&
                           a.Active &&
                           bookTime.TimeOfDay >= a.StartTime.TimeOfDay && bookTime.TimeOfDay <= a.EndTime.TimeOfDay &&
                           (a.DayName == dayName || a.EveryDay) &&
                           a.CanBook);
    }

    public async Task<int?> GetFlightCarrierIdByCodeAsync(string carrierCode)
    {
        return await Context.FlightCarriers
            .Where(fc => fc.CarrierCode == carrierCode)
            .Select(fc => fc.FlightCarrierId)
            .FirstOrDefaultAsync();
    }

    public async Task<string> GetZoneNameAsync(int carrierId, string state, string city)
    {
        var zones = await Context.FlightCarrierZones
            .Where(z => z.CarrierId == carrierId && z.StateName == state &&
                        (z.CityName == null || z.CityName == city))
            .ToListAsync();

        // Prefer a city-specific zone if available
        var cityZone = zones.FirstOrDefault(z => z.CityName == city);
        if (cityZone != null)
            return cityZone.ZoneName;

        // Otherwise, return state-level zone
        var stateZone = zones.FirstOrDefault(z => z.CityName == null);
        return stateZone?.ZoneName;
    }

    public async Task<int?> GetAirFreightRateIdFromZoneComboAsync(int carrierId, string fromZoneName, string toZoneName)
    {
        return await Context.FlightZoneCombos
            .Where(c => c.CarrierId == carrierId &&
                        c.FromZoneName == fromZoneName &&
                        c.ToZoneName == toZoneName)
            .Select(c => c.AirFreightRateId)
            .FirstOrDefaultAsync();
    }

    public async Task<List<AirFreightRate>> GetAirFreightRatesAsync(int airFreightRateId)
    {
        return await Context.AirFreightRates
            .Include(r => r.Speed)
            .Where(r => r.AirFreightRateId == airFreightRateId && r.Active)
            .ToListAsync();
    }

    public async Task<FlightRateCalculationDto> GetFlightRateCalculationDtoAsync(int jobId, string carrierCode,
        bool extraStopOffs, DateTime? bookTime)
    {
        var data = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new FlightRateCalculationDto
            {
                ClientId = j.UcjbClientId ?? 0,
                FromCity = j.PickupAddressLine5,
                FromState = j.PickupAddressLine6,
                ToCity = j.DeliveryAddressLine5,
                ToState = j.DeliveryAddressLine6,
                CarrierCode = carrierCode,
                TotalWeight = j.UcjbWeight.HasValue ? (decimal)j.UcjbWeight.Value : 0,
                Quantity = j.UcjbQty ?? 0,
                TotalPallets = j.TucJobItemJobs != null ? j.TucJobItemJobs.Count : 0,
                ExtraStopOffs = extraStopOffs ? 1 : 0,
                BookTime = bookTime,
                VehicleSizeId = j.UcjbSize ?? 0,
                DangerousGoods = j.Dgdocument ?? false,
                DryIceWeight = j.DryIceWeight ?? 0,
                Ppd = 0
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return data;
    }

    public async Task<JobTypeFlightRatingDto> GetJobTypeFlightRatingDtoAsync(int speedId)
    {
        var data = await Context.TucJobTypes
            .Where(s => s.UcjtId == speedId)
            .Select(s => new JobTypeFlightRatingDto
            {
                JobTypeId = s.UcjtId,
                JobTypeName = s.UcjtName,
                Description = s.UcjtDescription,
                Mins = s.Minutes
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return data;
    }

    public async Task<decimal?> GetExtraItemMultiplierByExtraChargeIdAsync(int extraChargeId)
    {
        var extraItemMultiplier = await Context.ExtraCharges
            .Where(e => e.ExtraChargeId == extraChargeId)
            .Select(e => e.ExtraItemMultiplier)
            .FirstOrDefaultAsync();

        return extraItemMultiplier;
    }

    public async Task<ExtraRateResultDto> CalculateExtraRatesAsync(ExtraRateCalculationRequest request)
    {
        var result = await Context.UTL_fncJob_ExtraRate(
                TotalWeight: request.TotalWeight,
                Quantity: request.Quantity,
                Cubic: request.Cubic,
                TotalPallets: request.TotalPallets,
                ExtraStopOffs: request.ExtraStopOffs,
                VehicleSizeID: request.VehicleSizeId,
                DangerousGoods: request.DangerousGoods,
                DryIceWeight: request.DryIceWeight,
                WaitTime: request.WaitTime,
                ExtraChargeID: request.ExtraChargeId,
                Holiday: request.IsHoliday,
                Afterhours: request.IsAfterHours,
                FromZoneCongestionID: request.FromZoneCongestionId,
                ToZoneCongestionID: request.ToZoneCongestionId,
                MFV: request.FuelSurcharge,
                PPD: request.Ppd)
            .FirstOrDefaultAsync();

        if (result == null) return new ExtraRateResultDto { Amount = 0, DriverPay = 0 };

        return new ExtraRateResultDto
        {
            Amount = result.Amount ?? 0,
            DriverPay = result.DriverPay ?? 0
        };
    }

    public async Task<string> GetAgentNameAsync(int agentId)
    {
        // Get Agent Name
        var agentName = await Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagName)
            .FirstOrDefaultAsync();

        return agentName;
    }

    public async Task<RecoveryAgentJobViewModel> GetRecoveryAgentDialogDataAsync(int jobId)
    {
        var recoveryAgentData = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new RecoveryAgentJobViewModel
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                AssignedAgent = j.Agent != null
                    ? new Suggestion
                    {
                        Id = j.Agent.UcagId,
                        Text = j.Agent.UcagName
                    }
                    : null,
                PickUpAddress = new AddressViewModel(
                    j.PickupAddressLine1,
                    j.PickupAddressLine2,
                    j.PickupAddressLine3,
                    j.PickupAddressLine4,
                    j.PickupAddressLine5,
                    j.PickupAddressLine6,
                    j.PickupAddressLine7,
                    j.PickupAddressLine8),
                DeliveryAddress = new AddressViewModel(
                    j.DeliveryAddressLine1,
                    j.DeliveryAddressLine2,
                    j.DeliveryAddressLine3,
                    j.DeliveryAddressLine4,
                    j.DeliveryAddressLine5,
                    j.DeliveryAddressLine6,
                    j.DeliveryAddressLine7,
                    j.DeliveryAddressLine8),
                PackageType = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : "Unknown",
                Priority = "High",
                LastKnownLocation = "Unknown",
                Customer = j.UcjbClient != null ? j.UcjbClient.UcclName : "Unknown",
                RecoveryJobs = j.Parent != null
                    ? j.Parent.InverseParent
                        .Where(rj => EF.Functions.Like(rj.UcjbNumber, "%R_"))
                        .Select(rj => new RecoveryJobViewModel
                        {
                            JobId = rj.UcjbId,
                            AssignedAgent = rj.Agent != null
                                ? new Suggestion
                                {
                                    Id = rj.Agent.UcagId,
                                    Text = rj.Agent.UcagName
                                }
                                : null,
                            RecoveryAgents = rj.JobRecoveryAgents.Count != 0
                                ? rj.JobRecoveryAgents.Select(ra => new RecoveryAgentViewModel
                                {
                                    RecoveryId = ra.RecoveryId,
                                    AgentName = ra.Agent != null ? ra.Agent.UcagName : null,
                                    Airport = ra.Airport != null ? ra.Airport.Name : null,
                                    PrimaryRecoveryAgent = ra.IsPrimary,
                                    AssignStatus = ra.IsActive ? "Currently Assigned" : "Not Assigned"
                                })
                                : null
                        })
                    : j.InverseParent
                        .Where(rj => EF.Functions.Like(rj.UcjbNumber, "%R_"))
                        .Select(rj => new RecoveryJobViewModel
                        {
                            JobId = rj.UcjbId,
                            AssignedAgent = rj.Agent != null
                                ? new Suggestion
                                {
                                    Id = rj.Agent.UcagId,
                                    Text = rj.Agent.UcagName
                                }
                                : null,
                            RecoveryAgents = rj.JobRecoveryAgents.Select(ra => new RecoveryAgentViewModel
                            {
                                RecoveryId = ra.RecoveryId,
                                AgentName = ra.Agent != null ? ra.Agent.UcagName : null,
                                Airport = ra.Airport != null ? ra.Airport.Name : null,
                                PrimaryRecoveryAgent = ra.IsPrimary,
                                AssignStatus = ra.IsActive ? "Currently Assigned" : "Not Assigned"
                            })
                        })
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return recoveryAgentData;
    }

    public async Task<List<Suggestion>> GetAgentOptionsByAirportAsync(int airportId)
    {
        var agents = await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .SelectMany(a => a.AgentVehicles)
            .Select(agentVehicle => new Suggestion
            {
                Id = agentVehicle.Agent.UcagId,
                Text = agentVehicle.Agent.UcagName
            })
            .Distinct()
            .AsNoTracking()
            .ToListAsync();

        return agents;
    }

    public async Task<List<Suggestion>> GetAllActiveAirportsWithAgentsAsync()
    {
        var agents = await Context.TblAirports
            .Where(a => a.Active && a.AgentVehicles.Any())
            .Select(a => new Suggestion
            {
                Id = a.AirportId,
                Text = a.Name
            })
            .AsNoTracking()
            .ToListAsync();

        return agents;
    }

    public async Task UpdateRecoveryAgentAsync(UpdateAgentRecoveryRequest request)
    {
        var recoveryAgent = await Context.JobRecoveryAgents.FindAsync(request.RecoveryId);
        ArgumentNullException.ThrowIfNull(recoveryAgent);

        if (request.IsPrimaryRecoveryAgent)
        {
            // Get the job ID through the recovery job relationship
            var recoveryJob = await Context.TucJobs
                .FirstOrDefaultAsync(j => j.JobRecoveryAgents
                    .Any(ra => ra.RecoveryId == request.RecoveryId));

            if (recoveryJob != null)
            {
                // Find the parent job (main job) to get all related recovery jobs
                var parentJobId = recoveryJob.ParentId ?? recoveryJob.UcjbId;

                // Remove primary status from all other recovery agents in related recovery jobs
                var otherPrimaryAgents = await Context.JobRecoveryAgents
                    .Where(ra => ra.Job.ParentId == parentJobId &&
                                 ra.RecoveryId != request.RecoveryId &&
                                 ra.IsPrimary)
                    .ToListAsync();

                foreach (var agent in otherPrimaryAgents) agent.IsPrimary = false;

                // Also check recovery jobs where the parent job is the main job
                var childJobPrimaryAgents = await Context.JobRecoveryAgents
                    .Where(ra => ra.Job.UcjbId != parentJobId &&
                                 ra.Job.ParentId == parentJobId &&
                                 ra.RecoveryId != request.RecoveryId &&
                                 ra.IsPrimary)
                    .ToListAsync();

                foreach (var agent in childJobPrimaryAgents) agent.IsPrimary = false;
            }
        }

        // Update the recovery agent
        recoveryAgent.IsPrimary = request.IsPrimaryRecoveryAgent;
        recoveryAgent.UpdatedOn = _infoService.GetCurrentTenantTime();

        await Context.SaveChangesAsync();
    }

    public async Task RemoveRecoveryAgentAsync(int recoveryId)
    {
        // Get the recovery agent to remove
        var recoveryAgent = await Context.JobRecoveryAgents.FindAsync(recoveryId);
        ArgumentNullException.ThrowIfNull(recoveryAgent);

        // Check if this is the only recovery agent on the job
        var recoveryJob = await Context.TucJobs
            .Include(j => j.JobRecoveryAgents)
            .FirstOrDefaultAsync(j => j.JobRecoveryAgents.Any(ra => ra.RecoveryId == recoveryId));
        ArgumentNullException.ThrowIfNull(recoveryJob);

        // Remove the recovery agent
        Context.JobRecoveryAgents.Remove(recoveryAgent);

        await Context.SaveChangesAsync();
    }

    private static void UpdateJobAddressWithAirportInfo(List<AirportAddressInfoDto> airports, TucJob job, int airportId, int? timeZoneId,
        bool isDeliveryAddress)
    {
        var airport = airports.FirstOrDefault(a => a.AirportId == airportId);

        ArgumentNullException.ThrowIfNull(airport);

        if (isDeliveryAddress)
        {
            job.DeliveryAddressLine1 = airport.AddressLine1;
            job.DeliveryAddressLine2 = airport.AddressLine2;
            job.DeliveryAddressLine3 = airport.AddressLine3;
            job.DeliveryAddressLine4 = airport.AddressLine4;
            job.DeliveryAddressLine5 = airport.AddressLine5;
            job.DeliveryAddressLine6 = airport.AddressLine6;
            job.DeliveryAddressLine7 = airport.AddressLine7;
            job.DeliveryAddressLine8 = airport.AddressLine8;
            job.DeliveryLatitude = airport.Latitude;
            job.DeliveryLongitude = airport.Longitude;
            job.DeliverByTimeZoneId ??= timeZoneId;
        }
        else
        {
            job.PickupAddressLine1 = airport.AddressLine1;
            job.PickupAddressLine2 = airport.AddressLine2;
            job.PickupAddressLine3 = airport.AddressLine3;
            job.PickupAddressLine4 = airport.AddressLine4;
            job.PickupAddressLine5 = airport.AddressLine5;
            job.PickupAddressLine6 = airport.AddressLine6;
            job.PickupAddressLine7 = airport.AddressLine7;
            job.PickupAddressLine8 = airport.AddressLine8;
            job.PickUpLatitude = airport.Latitude;
            job.PickUpLongitude = airport.Longitude;
            job.PickupTimeZoneId ??= timeZoneId;
        }
    }

    public async Task<string> GetWebhookEventsAsStringAsync()
    {
        var webhookEvents = await Context.FlightWebhookEventTypes
            .AsNoTracking()
            .Where(e => e.IsActive && e.IsEnabled)
            .Select(e => new WebhookEventDto
            {
                EventCode = e.EventCode,
                AdditionalParameter = e.RequiresParameter ? e.ParameterValue : null
            })
            .ToListAsync();

        var eventStrings = webhookEvents.Select(e => e.AdditionalParameter != null
            ? $"{e.EventCode}{e.AdditionalParameter}"
            : e.EventCode);

        return string.Join(",", eventStrings);
    }

    public async Task<FlightCargoProcessingModel> CalculateCargoReadyTimeAsync(
        int jobId,
        string carrierFsCode,
        DateTime flightArrivalTime)
    {
        var now = _infoService.GetCurrentTenantTime();
        var cargoModel = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new FlightCargoProcessingModel
            {
                ArrivalTime = flightArrivalTime,
                DeliverByTime = j.DeliverByTime,
                ProcessingTimeMins = j.ToAirport.ProcessingTime ?? 0,
                CargoOpeningTime = j.ToAirport.CargoFacilities
                                       .FirstOrDefault(c => c.Carrier.CarrierCode == carrierFsCode).OpeningTime ??
                                   now.ResetTimeToStartOfDay(),
                CargoClosingTime = j.ToAirport.CargoFacilities
                                       .FirstOrDefault(c => c.Carrier.CarrierCode == carrierFsCode).ClosingTime ??
                                   now.ResetTimeToEndOfDay()
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return cargoModel;
    }

    public async Task<bool> CanAssignAgentToJobAsync(int agentJobId)
    {
        if (System.Diagnostics.Debugger.IsAttached)
            return true;

        var result = await Context.TucJobs
            .AsNoTracking()
            .Where(j => j.UcjbId == agentJobId)
            .SelectMany(j => j.Parent.InverseParent)
            .Select(siblingJob => new
            {
                HasFlightSpeedGrouping = siblingJob.UcjbSpeedNavigation != null
                                         && (siblingJob.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                                             || siblingJob.UcjbSpeedNavigation.GroupingId ==
                                             (int)UrgentSpeedGrouping.Flight),
                HasTucJobNationwides = siblingJob.TucJobNationwides.Any()
            })
            .ToListAsync();

        var flightSpeedJobs = result
            .Where(r => r.HasFlightSpeedGrouping)
            .ToList();
        return flightSpeedJobs.Count == 0
               || flightSpeedJobs.Any(job => job.HasTucJobNationwides);
    }

    public async Task<List<GetAirportsDto>> GetAllActiveAirportsAsync()
    {
        var airports = await Context.TblAirports
            .Where(a => a.Active)
            .Select(a => new GetAirportsDto
            {
                AirportId = a.AirportId,
                FlightBufferMinutes = a.FlightBufferMinutes,
                AirportCode = a.AirportCode,
                Timezone = a.Timezone
            })
            .AsNoTracking()
            .ToListAsync();

        return airports;
    }
}