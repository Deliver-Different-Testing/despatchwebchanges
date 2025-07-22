using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace DespatchWeb.Repositories;

public class NationwideJobRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService)
    : BaseJobRepository(contextFactory, infoService), INationwideJobRepository
{
    private readonly ITenantInfoService _infoService = infoService;

  public async Task AddJobNationwideAsync(int jobId, AddFlightToJobDto flights, List<string> webhookIds)
{
    try
    {
        ArgumentNullException.ThrowIfNull(jobId);
        ArgumentNullException.ThrowIfNull(flights);
        ArgumentNullException.ThrowIfNull(webhookIds);

        if (flights.FlightSegments.Count == 0)
            throw new ArgumentException("Flight list cannot be empty", nameof(flights));

        // Get the primary flight (first leg)
        var primaryFlight = flights.FlightSegments.First();
        ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.CarrierFsCode);
        ArgumentException.ThrowIfNullOrWhiteSpace(primaryFlight.FlightNumber);

        var job = await Context.TucJobs
            .Include(j => j.Parent)
            .ThenInclude(tucJob => tucJob.InverseParent)
            .Where(j => j.UcjbId == jobId)
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(job);

        // Create the main flight record
        var jobNationwide = new TucJobNationwide
        {
            UcnwJobId = job.UcjbId,
            UcnwJobNumber = job.UcjbNumber,
            UcnwClientId = job.UcjbClientId ?? 0,
            UcnwFlightNo = primaryFlight.CarrierFsCode + primaryFlight.FlightNumber,
            UcnwEtd = primaryFlight.DepartureTime,
            UcnwEta = primaryFlight.ArrivalTime,
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
            DepartureAirportTimeZoneId = await GetTimeZoneIdByNameAsync(primaryFlight.DepartureAirportTimeZone),
            ArrivalAirportFsCode = primaryFlight.ArrivalAirportFsCode,
            ArrivalAirportName = primaryFlight.ArrivalAirportName,
            ArrivalAirportCity = primaryFlight.ArrivalAirportCity,
            ArrivalAirportCountry = primaryFlight.ArrivalAirportCountry,
            ArrivalAirportTimeZone = primaryFlight.ArrivalAirportTimeZone,
            ArrivalAirportTimeZoneId = await GetTimeZoneIdByNameAsync(primaryFlight.ArrivalAirportTimeZone),
            DepartureTerminal = primaryFlight.DepartureTerminal,
            ArrivalTerminal = primaryFlight.ArrivalTerminal,
            AircraftName = primaryFlight.AircraftName
        };

        // Update job status and properties
        job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
        job.UcjbStatus = (int)JobStatus.Dispatched;
        job.UcjbDate = primaryFlight.DepartureTime;
        job.UcjbTime = primaryFlight.DepartureTime;

        // Set Pickup Job Deliver By
        if (job.FromAirportId != null)
        {
            var airportProcessingTime = await GetAirportProcessingTimeAsync(job.FromAirportId.Value);
            var pickUpJob = job.Parent.InverseParent.First(j => j.UcjbNumber.EndsWith('1'));
            pickUpJob.DeliverByTime = primaryFlight.DepartureTime.AddMinutes(-airportProcessingTime);
            pickUpJob.DeliverByTimeZoneId = job.PickupTimeZoneId;
        }

        // Second part
        var flightPart = flights.FlightSegments.Count > 1 ? flights.FlightSegments[1] : primaryFlight;
        job.DeliverByTime = flightPart.ArrivalTime;
        job.DeliverByTimeZoneId = await GetTimeZoneIdByNameAsync(flightPart.ArrivalAirportTimeZone);

        // Set delivery job pick-up time
        if (job.ToAirportId != null)
        {
            var airportProcessingTime = await GetAirportProcessingTimeAsync(job.ToAirportId.Value);
            var lastFlight = flights.FlightSegments.Last();
            var deliveryJob = job.Parent.InverseParent.First(j => j.UcjbNumber.EndsWith('3'));
            deliveryJob.UcjbTime = lastFlight.ArrivalTime.AddMinutes(airportProcessingTime);

            // Set TimeZone
            var timeZoneForDeliveryJob = await GetTimeZoneIdByNameAsync(lastFlight.ArrivalAirportTimeZone);
            deliveryJob.PickupTimeZoneId = timeZoneForDeliveryJob;
            deliveryJob.DeliverByTimeZoneId = timeZoneForDeliveryJob;
        }

        var currentTime = _infoService.GetCurrentTenantTime();
        job.UcjbDispDate = currentTime;
        job.UcjbDispTime = currentTime;

        // Add the main flight record
        await Context.AddAsync(jobNationwide);

        // Add additional flight legs if there is multiple
        if (flights.FlightSegments.Count > 1)
        {
            for (var i = 1; i < flights.FlightSegments.Count; i++)
            {
                var leg = flights.FlightSegments[i];
                var connectionSegment = new TucJobNationwide
                {
                    UcnwJobId = job.UcjbId,
                    UcnwJobNumber = job.UcjbNumber,
                    UcnwClientId = job.UcjbClientId ?? 0,
                    UcnwFlightNo = leg.CarrierFsCode + leg.FlightNumber,
                    UcnwEtd = leg.DepartureTime,
                    UcnwEta = leg.ArrivalTime,
                    WebhookAlertId = webhookIds[i],
                    UcnwLegNumber = i + 1,
                    UcnwAirlineName = leg.AirlineName,
                    CarrierFsCode = leg.CarrierFsCode,
                    DepartureAirportFsCode = leg.DepartureAirportFsCode,
                    DepartureAirportName = leg.DepartureAirportName,
                    DepartureAirportCity = leg.DepartureAirportCity,
                    DepartureAirportCountry = leg.DepartureAirportCountry,
                    DepartureAirportTimeZone = leg.DepartureAirportTimeZone,
                    DepartureAirportTimeZoneId = await GetTimeZoneIdByNameAsync(leg.DepartureAirportTimeZone),
                    ArrivalAirportFsCode = leg.ArrivalAirportFsCode,
                    ArrivalAirportName = leg.ArrivalAirportName,
                    ArrivalAirportCity = leg.ArrivalAirportCity,
                    ArrivalAirportCountry = leg.ArrivalAirportCountry,
                    ArrivalAirportTimeZone = leg.ArrivalAirportTimeZone,
                    ArrivalAirportTimeZoneId = await GetTimeZoneIdByNameAsync(leg.ArrivalAirportTimeZone),
                    DepartureTerminal = leg.DepartureTerminal,
                    ArrivalTerminal = leg.ArrivalTerminal,
                    AircraftName = leg.AircraftName
                };

                await Context.AddAsync(connectionSegment);
            }
        }

        // Add note record
        var note = new TucNote
        {
            JobId = jobId,
            NoteTypeId = (int)NoteType.FlightUpdate,
            NoteText = $"Flight {flights.FlightSegments[0]?.FlightNumber} added to job {jobId}",
            CreatedBy = _infoService.GetStaffId(),
            CreatedDate = currentTime
        };
        await Context.AddAsync(note);

        await Context.SaveChangesAsync();

        var journeyRecord = new JobDeliveryJourney
        {
            JobId = jobId,
            FlightId = jobNationwide.UcnwId,
            ChangeType = nameof(DeliveryJourneyChangeType.FlightAssignment),
            StaffId = _infoService.GetStaffId(),
            UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff)
        };
        await Context.AddAsync(journeyRecord);

        // Final save for the journey record
        await Context.SaveChangesAsync();
    }
    catch (Exception e)
    {
        Log.Error(e, "An error occured adding Flight {FlightFlightNumber} to job {JobId}",
            flights.FlightSegments[0]?.FlightNumber,
            jobId);
        throw;
    }
}

    private async Task<int> GetTimeZoneIdByNameAsync(string timeZoneName)
    {
        return await Context.TimeZones
            .Where(tz => tz.Name == timeZoneName)
            .Select(tz => tz.Id)
            .FirstOrDefaultAsync();
    }

    public async Task<List<Suggestion>> GetNearbyAirportsAsync(int jobId, bool usePickup = true)
    {
        const double maxDistanceMiles = 250;

        // Get job coordinates and nearby airports in a single query
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
                    AirportLongitude = airport.Longitude.Value
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
                    item.AirportLongitude)
            })
            .Where(result => result.Distance <= maxDistanceMiles)
            .OrderBy(result => result.Distance)
            .Select(result => new Suggestion
            {
                Id = result.AirportId,
                Text = $"{result.Name} ({result.Distance} mi)"
            })
            .ToList();
    }

    public async Task<string> GetSingleAirportCodeByIdAsync(int airportId)
    {
        var airportCode = await Context.TblAirports
            .Where(a => a.AirportId == airportId)
            .Select(a => a.AirportCode)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return airportCode;
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

   public async Task<bool> AddAgentToJobAsync(int agentId, int jobId, bool includeStopJobs = false)
{
    try
    {
        var job = await Context.TucJobs
            .Include(j => j.Parent).ThenInclude(j => j.InverseParent)
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
        var agentName = Context.TucAgents
            .Where(a => a.UcagId == agentId)
            .Select(a => a.UcagName)
            .FirstOrDefault();

        if (includeStopJobs)
        {
            var mainJobNumber = job.UcjbNumber;
            if (string.IsNullOrEmpty(mainJobNumber)) throw new ArgumentNullException(nameof(mainJobNumber));

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
        
        var journeyRecord = new JobDeliveryJourney
        {
            JobId = jobId,
            NewAgentId = agentId,
            ChangeType = nameof(DeliveryJourneyChangeType.AgentAssignment),
            StaffId = _infoService.GetStaffId(),
            UpdatedByType = nameof(DeliveryJourneyUpdatedByType.Staff)
        };
        await Context.JobDeliveryJourneys.AddAsync(journeyRecord);
        
        await Context.SaveChangesAsync();

        return true;
    }
    catch (Exception e)
    {
        Log.Error(e, "An error occured adding Agent {AgentId} to job {JobId}", agentId, jobId);
        return false;
    }
}

    public async Task<List<DispatchJobViewModel>> NationwideJobListAsync(JobQueryParams queryParams, bool isInternal,
        bool isUsTenant,
        string clientIds, NationwideWidget windowPane,
        List<int> selectedViewIds)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return [];

        return await DespatchQry(
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

    public async Task<List<Suggestion>> GetActiveAirlineOptionsAsync()
    {
        var airlines = await Context.FlightCarriers
            .Where(fc => fc.IsActive == true)
            .Select(x => new Suggestion
            {
                Id = x.FlightCarrierId,
                Text = x.CarrierCode
            })
            .ToListAsync();

        return airlines;
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

        Context.TucManualMessages.Add(request);
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
        var job = await Context.TucJobs
            .Include(j => j.TucJobNationwides)
            .Include(j => j.TucJobReadTracker)
            .FirstOrDefaultAsync(j => j.UcjbId == jobId);
        ArgumentNullException.ThrowIfNull(job);

        // Reset fields
        job.UcjbStatus = (int)JobStatus.New;
        job.InternalStatus = (int)InternalJobStatus.NewJobs;
        job.UcjbJobDone = false;
        job.UcjbVoid = false;
        job.UcjbCourierId = null;
        job.UcjbDispDate = null;
        job.UcjbDispTime = null;
        job.UcjbPaged = false;
        job.UcjbPagedTime = null;
        job.UcjbComplTime = null;
        job.UcjbMobileSend = false;
        job.AutoDespatch = false;
        job.PickRunOrder = null;
        job.DropRunOrder = null;
        job.DesCheck = false;
        job.FdcourierId = null;
        job.FirstJob = false;
        job.AgentId = null;
        job.UcjbFlightDetails = string.Empty;

        // Remove flight record
        if (job.TucJobNationwides != null && job.TucJobNationwides.Count != 0)
        {
            var flightDetails = job.TucJobNationwides.ToList();
            Context.TucJobNationwides.RemoveRange(flightDetails);
        }

        // Remove read record
        if (job.TucJobReadTracker != null) Context.TucJobReadTrackers.Remove(job.TucJobReadTracker);

        var note = new TucNote
        {
            JobId = jobId,
            NoteTypeId = (int)NoteType.FlightUpdate,
            NoteText = "Job restored",
            CreatedBy = _infoService.GetStaffId(),
            CreatedDate = _infoService.GetCurrentTenantTime()
        };

        await Context.AddAsync(note);
        await Context.SaveChangesAsync();
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

    public async Task<ExtraRateResultDto> CalculateExtraRatesAsync(
        decimal totalWeight, int quantity, decimal cubic, int totalPallets, int extraStopOffs,
        int vehicleSizeId, bool dangerousGoods, decimal dryIceWeight, int? waitTime,
        int? extraChargeId, bool isHoliday, bool isAfterHours, decimal fuelSurcharge,
        int? fromZoneCongestionId = null, int? toZoneCongestionId = null)
    {
        var result = await Context.UTL_fncJob_ExtraRate(
                TotalWeight: totalWeight,
                Quantity: quantity,
                Cubic: cubic,
                TotalPallets: totalPallets,
                ExtraStopOffs: extraStopOffs,
                VehicleSizeID: vehicleSizeId,
                DangerousGoods: dangerousGoods,
                DryIceWeight: dryIceWeight,
                WaitTime: waitTime,
                ExtraChargeID: extraChargeId,
                Holiday: isHoliday,
                Afterhours: isAfterHours,
                FromZoneCongestionID: fromZoneCongestionId,
                ToZoneCongestionID: toZoneCongestionId,
                MFV: fuelSurcharge)
            .FirstOrDefaultAsync();

        if (result == null) return new ExtraRateResultDto { Amount = 0, DriverPay = 0 };

        return new ExtraRateResultDto
        {
            Amount = result.Amount ?? 0,
            DriverPay = result.DriverPay ?? 0
        };
    }
}
