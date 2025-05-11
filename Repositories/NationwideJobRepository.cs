using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.FlightStats;
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
           // ArgumentException.ThrowIfNullOrWhiteSpace(webhookAlertId);

            if (!flights.FlightSegments.Any())
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

            // Create main flight record
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
                UcnwAirlineName = primaryFlight.AirlineName
            };

            // First operation - Update job status
            job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
            job.UcjbStatus = (int)JobStatus.Dispatched;

            job.UcjbDate = primaryFlight.DepartureTime;
            job.UcjbTime = primaryFlight.DepartureTime;

            // Use the last flight leg's arrival time for delivery timing
            var lastFlight = flights.FlightSegments.Last();
            job.Parent.InverseParent.Last().UcjbTime =
                lastFlight.ArrivalTime.AddMinutes(60);

            job.UcjbDispDate = primaryFlight.DepartureTime;
            job.UcjbDispTime = primaryFlight.DepartureTime;

            await Context.SaveChangesAsync();
            await Context.TucJobNationwides.AddAsync(jobNationwide);

            // Add additional flight legs if there are multiple
            if (flights.FlightSegments.Count > 1)
            {
                for (int i = 1; i < flights.FlightSegments.Count; i++)
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
                        WebhookAlertId = webhookIds[i], // Same webhook for all legs
                        UcnwLegNumber = ++i,
                        UcnwAirlineName = leg.AirlineName
                    };

                    await Context.TucJobNationwides.AddAsync(connectionSegment);
                }
            }

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured adding Flight {FlightFlightNumber} to job {JobId}", flights.FlightSegments[0]?.FlightNumber,
                jobId);
            throw;
        }
    }

    public async Task<List<Suggestion>> GetNearbyAirportsAsync(int jobId, int? maxDistanceMiles = 100)
    {
        // Set default value if null
        var distance = maxDistanceMiles ?? 100;

        // Get pickup coordinates and nearby airports in a single query
        var pickupAndAirports = await (
                from job in Context.TucJobs
                where job.UcjbId == jobId && job.PickUpLatitude != null && job.PickUpLongitude != null
                join airport in Context.TblAirports on 1 equals 1
                where airport.Active && airport.Latitude != null && airport.Longitude != null
                select new
                {
                    PickupLatitude = job.PickUpLatitude.Value,
                    PickupLongitude = job.PickUpLongitude.Value,
                    airport.AirportId,
                    airport.Name,
                    AirportLatitude = airport.Latitude.Value,
                    AirportLongitude = airport.Longitude.Value
                })
            .AsNoTracking()
            .ToListAsync();

        // Return empty list if no valid job found
        if (pickupAndAirports.Count == 0) return [];

        // Extract pickup coordinates from the first result (all have same pickup coordinates)
        var pickupLatitude = pickupAndAirports.First().PickupLatitude;
        var pickupLongitude = pickupAndAirports.First().PickupLongitude;

        // Calculate distances, filter and sort
        return pickupAndAirports
            .Select(item => new
            {
                item.AirportId,
                item.Name,
                Distance = DistanceCalculator.CalculateDistance(
                    pickupLatitude,
                    pickupLongitude,
                    item.AirportLatitude,
                    item.AirportLongitude)
            })
            .Where(result => result.Distance <= distance)
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

    public async Task<List<string>> GetActiveAirlineCodesAsync()
    {
        var airlineCodes = await Context.FlightCarriers
            .Where(fc => fc.IsActive == true)
            .Select(fc => fc.CarrierCode)
            .AsNoTracking()
            .ToListAsync();

        return airlineCodes;
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

    public async Task<bool> AddAgentToJobAsync(int agentId, int jobId)
    {
        try
        {
            var job = await Context.TucJobs.FindAsync(jobId);
            ArgumentNullException.ThrowIfNull(job);

            var currentDate = _infoService.GetCurrentTenantTime();
            var isDepartureAirportAgent = job.FromAirportId != null && job.ToAirportId == null;

            job.AgentId = agentId;
            job.UcjbStatus = isDepartureAirportAgent ? (int)JobStatus.InboundAgentAssigned : (int)JobStatus.OutboundAgentAssigned;
            job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
            job.UcjbDispDate = currentDate;
            job.UcjbDispTime = currentDate;

            await Context.SaveChangesAsync();

            var agentName = Context.TucAgents.Where(a => a.UcagId == agentId).Select(a => a.UcagName).FirstOrDefault();
            await SaveNoteAsync(jobId, $"Agent {agentName} assigned");

            return true;
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occured adding Agent {AgentId} to job {JobId}", agentId, jobId);
            return false;
        }
    }


    public async Task<List<DispatchJobViewModel>> NationwideJobListAsync(string order, string orderDirection,
        bool isInternal, bool isUsTenant,
        string clientIds, NationwideWidget windowPane,
        List<int> selectedViewIds)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return [];

        return await DespatchQry(
            AppPage.Domestic,
            order,
            orderDirection,
            isInternal,
            isUsTenant,
            clientIds,
            selectedViewIds,
            windowPane);
    }

    private async Task<NationwideJobDetail> GetJobDetailsAsync(int jobId)
    {
        return await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new NationwideJobDetail
            {
                AirPortId = j.FromAirportId ?? j.ToAirportId,
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
            nationwideJob.Quantity, // Added missing parameter
            nationwideJob.Cubic, // Added missing parameter
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

    public async Task<decimal> GetCarrierFlightRateByJobIdAsync(int jobId, string carrierName, bool extraStopOffs,
        DateTime? bookTime)
    {
        try
        {
            var job = await Context.TucJobs.Include(j => j.TucJobItems).FirstOrDefaultAsync(j => j.UcjbId == jobId);
            var returnValue = new OutputParameter<int>();

            var results = await Context.Procedures.DD_stpGetCarrierFlightRateAsync(
                clientID: job.UcjbClientId,
                fromCity: job.PickupAddressLine4,
                fromState: job.PickupAddressLine5,
                toCity: job.DeliveryAddressLine4,
                toState: job.DeliveryAddressLine5,
                carrierName: carrierName,
                totalWeight: job.UcjbWeight.HasValue ? (decimal)job.UcjbWeight.Value : 0,
                quantity: job.UcjbQty,
                cubic: null,
                totalPallets: job.TucJobItems.Count,
                extraStopOffs: extraStopOffs ? 1 : 0,
                bookTime: bookTime,
                vehicleSizeID: job.UcjbSize,
                dangerousGoods: false,
                dryIceWeight: job.DryIceWeight,
                waitTime: null,
                returnValue: returnValue);

            if (returnValue.Value != 0)
                throw new NullReferenceException(
                    $"Failed to retrieve carrier rates. Return value: {returnValue.Value}");

            if (results.Count != 0) return results.Select(r => r.Rate ?? 0).FirstOrDefault();

            Log.Warning("No carrier flight rates found for job {JobId}", jobId);
            return 0;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving carrier flight rates for job {JobId}", jobId);
            return 0;
        }
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
        var currentTenantTime = _infoService.GetCurrentTenantTime();

        // Create object
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
                CompletedTime = _infoService.FormatDateForTenant(j.UcjbComplTime),

                PodName = j.UcjbPodname,
                SuburbTo = j.DeliveryAddressLine6,
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        var subject = FormatDelimMessage(smppSetting.AgentEmailSubject, "[", "]", agentQuoteTemplateDto);
        var body = FormatDelimMessage(smppSetting.AgentEmailMessage, "[", "]", agentQuoteTemplateDto);

        var request = new TucManualMessage
        {
            JobId = jobId,
            Subject = subject,
            ReplyToEmailAddress = smppSetting.AgentEmailReplyAddress,
            UcmmMessage = body,
            UcmmStaffId = staffId,
            UcmmTimeSent = currentTenantTime,
            SendToEmailAddress = agentEmail
        };

        // ToDo: Add mobile sending

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

        await Context.SaveChangesAsync();

        // Make a note
        await SaveNoteAsync(jobId, "Job restored");
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
}
