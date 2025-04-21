using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.FlightStats;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;
using Serilog;

namespace DespatchWeb.Repositories;

public class NationwideJobRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantInfoService infoService)
    : BaseJobRepository(contextFactory, infoService), INationwideJobRepository
{
    public async Task AddJobNationwideAsync(int jobId, ScheduledFlight flight, string webhookAlertId)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(jobId);
            ArgumentNullException.ThrowIfNull(flight);
            ArgumentException.ThrowIfNullOrWhiteSpace(webhookAlertId);
            ArgumentException.ThrowIfNullOrWhiteSpace(flight.CarrierFsCode);
            ArgumentException.ThrowIfNullOrWhiteSpace(flight.FlightNumber);

            var job = await Context.TucJobs
                .Include(j => j.Parent)
                .ThenInclude(tucJob => tucJob.InverseParent)
                .Where(j => j.UcjbId == jobId)
                .FirstOrDefaultAsync();

            ArgumentNullException.ThrowIfNull(job);

            var jobNationwide = new TucJobNationwide
            {
                UcnwJobId = job.UcjbId,
                UcnwJobNumber = job.UcjbNumber,
                UcnwClientId = job.UcjbClientId ?? 0,
                UcnwFlightNo = flight.CarrierFsCode + flight.FlightNumber,
                UcnwEtd = flight.DepartureTime,
                UcnwEta = flight.ArrivalTime,
                WebhookAlertId = webhookAlertId
            };

            // First operation - Update job status
            job.InternalStatus = (int)InternalJobStatus.AwaitingPod;
            job.UcjbTime = flight.DepartureTime; // ToDo: Update this to the tenant timezone
            job.Parent.InverseParent.Last().UcjbTime =
                flight.ArrivalTime.AddMinutes(60); // ToDo: Update this to the tenant timezone
            job.UcjbStatus = (int)JobStatus.Dispatched;

            await Context.SaveChangesAsync();

            await Context.TucJobNationwides.AddAsync(jobNationwide);
            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured adding Flight {flight?.FlightNumber} to job {jobId}");
            throw;
        }
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
            var job = await Context.TucJobs.Where(j => j.UcjbId == jobId).FirstOrDefaultAsync();
            job.AgentId = agentId;
            job.UcjbStatus = (int)JobStatus.Dispatched;
            job.InternalStatus = (int)InternalJobStatus.AwaitingPod;

            await Context.SaveChangesAsync();

            return true;
        }
        catch (Exception e)
        {
            Log.Error(e, $"An error occured adding Agent {agentId} to job {jobId}");
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

    public async Task<Dictionary<string, decimal>> GetBatchCarrierFlightRatesByJobIdAsync(
    int jobId,
    List<string> carrierCodes,
    DateTime? bookTime)
{
    if (carrierCodes == null || carrierCodes.Count == 0) return new Dictionary<string, decimal>();

    var result = new Dictionary<string, decimal>();

    try
    {
        var job = await Context.TucJobs
            .Include(j => j.TucJobItems)
            .FirstOrDefaultAsync(j => j.UcjbId == jobId);

        if (job == null)
        {
            Log.Warning("Job not found for ID {JobId} when getting batch carrier rates", jobId);
            return result;
        }

        // Set up a list of tasks to run in parallel
        var tasks = carrierCodes.Select(async carrierName =>
        {
            try
            {
                var returnValue = new OutputParameter<int>();

                var carrierResults = await Context.Procedures.DD_stpGetCarrierFlightRateAsync(
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
                    extraStopOffs: 0, // Default to false, we can optimize this later
                    bookTime: bookTime,
                    vehicleSizeID: job.UcjbSize,
                    dangerousGoods: false,
                    dryIceWeight: job.DryIceWeight,
                    waitTime: null,
                    returnValue: returnValue);

                if (returnValue.Value == 0 && carrierResults.Count > 0)
                {
                    return (carrierName, carrierResults.Select(r => r.Rate ?? 0).FirstOrDefault());
                }

                return (carrierName, 0m);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error retrieving carrier rate for {Carrier} and job {JobId}",
                    carrierName, jobId);
                return (carrierName, 0m);
            }
        }).ToList();

        // Execute all the tasks in parallel and wait for them to complete
        var results = await Task.WhenAll(tasks);

        // Convert the results to a dictionary
        foreach (var (carrierName, rate) in results)
        {
            result[carrierName] = rate;
        }

        Log.Information("Retrieved rates for {CarrierCount} carriers for job {JobId}",
            result.Count, jobId);

        return result;
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error retrieving batch carrier flight rates for job {JobId}", jobId);
        return result;
    }
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

        var staffId = infoService.GetStaffId();
        var currentTenantTime = infoService.GetCurrentTenantTime();

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
                CompletedTime = j.UcjbComplTime ?? DateTime.MinValue,
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
        while (format?.Length > 0)
        {
            var c = Strings.Left(format, 1);
            format = Strings.Mid(format, 2);
            if (c == startDelim)
            {
                var fieldName = Strings.Left(format, Strings.InStr(format, endDelim) - 1);
                format = Strings.Mid(format, Strings.InStr(format, endDelim) + 1);
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
        message = Strings.Trim(message);
        return message;
    }
}
