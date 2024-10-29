using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using Microsoft.EntityFrameworkCore;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Vehicle = DespatchWeb.Models.Vehicle;
namespace DespatchWeb.Repositories;

public class NationwideJobRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseJobRepository(contextFactory), INationwideJobRepository
{
    

    public async Task<List<JobViewModel>> NationwideJobListAsync(string status,
        string order, string ascending, bool isInternal, string clientIds, NationwideWindowPanel windowPane,
        List<int> selectedViewIds)
    {
        if (isInternal == false && string.IsNullOrEmpty(clientIds))
            return new List<JobViewModel>();

        // Get view specific filters
        var viewFilters = selectedViewIds != null && selectedViewIds.Any()
            ? await Context.TblDespatchViews
                .Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
                .Select(dv => dv.WhereCondition)
                .ToListAsync()
            : new List<string>();

        return await DespatchQry(AppPage.Domestic, status, order, ascending, isInternal, clientIds,
            viewFilters, windowPane);
    }

    public async Task<bool> AddJobNationwideAsync(int jobId, ScheduledFlight flight, string webhookAlertId)
    {
        if (flight == null)
            throw new ArgumentNullException(nameof(flight), "Flight information cannot be null.");

        try
        {
            var job = await Context.TblJobs
                .Where(j => j.JobId == jobId)
                .Select(j => new
                {
                    j.JobId,
                    j.Number,
                    j.ClientId,
                    j.ParentId,
                    j.CourierId
                })
                .FirstOrDefaultAsync();

            if (job == null)
                throw new KeyNotFoundException($"Job with ID {jobId} not found.");

            var jobNationwide = new TucJobNationwide
            {
                UcnwJobId = job.JobId,
                UcnwJobNumber = job.Number,
                UcnwClientId = job.ClientId ?? 0,
                UcnwFlightNo = flight.CarrierFsCode + flight.FlightNumber,
                UcnwEtd = flight.DepartureTime,
                UcnwEta = flight.ArrivalTime,
                WebhookAlertId = webhookAlertId
            };
            Context.TucJobNationwides.Add(jobNationwide);

            // Update job status
            var jobToUpdate = new TucJob
            {
                UcjbId = jobId, InternalStatus = (int)InternalJobStatus.AwaitingPod
            };

            Context.TucJobs.Attach(jobToUpdate);
            Context.Entry(jobToUpdate).Property(x => x.InternalStatus).IsModified = true;

            // Apply updates
            await Context.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            // Log the exception
            Log.Error(ex, $"AddJobNationwideAsync:{ex.Message}");
            return false;
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
            .FirstOrDefaultAsync();

        return (airportCodes?.ToAirport, airportCodes?.FromAirport);
    }

    public async Task<IEnumerable<AgentViewModel>> GetAgentsAsync(int jobId)
    {
        var job = await GetJobDetailsAsync(jobId);
        var agents = await GetEligibleAgentsAsync(job.AirPortId, job.VehicleSizeId);
        return await ProcessAgentsInParallelAsync(job, agents);
    }

    public async Task<bool> AddAgentToJobAsync(int agentId, int jobId)
    {
        try
        {
            var jobToUpdate = new TucJob
            {
                UcjbId = jobId,
                AgentId = agentId,
                InternalStatus = (int)InternalJobStatus.AwaitingPod
            };

            Context.TucJobs.Attach(jobToUpdate);
            Context.Entry(jobToUpdate).Property(x => x.AgentId).IsModified = true;
            Context.Entry(jobToUpdate).Property(x => x.InternalStatus).IsModified = true;

            await Context.SaveChangesAsync();

            return true;
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return false;
        }
    }

    private async Task<JobDetails> GetJobDetailsAsync(int jobId)
    {
        return await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new JobDetails
            {
                AirPortId = j.FromAirportId,
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
                DryIceWeight = j.DryIceWeight
            })
            .FirstOrDefaultAsync();
    }

    private async Task<List<AgentInfo>> GetEligibleAgentsAsync(int? airportId, int? vehicleSizeId)
    {
        return await Context.AgentVehicles
            .Where(av => av.AirportId == airportId && av.VehicleSizeId == vehicleSizeId)
            .Select(a => new AgentInfo
            {
                AgentId = a.AgentId.Value,
                AgentName = a.Agent.UcagName,
                AgentRanking = a.Agent.Ranking.AgentRankingName,
                DistanceRateId = a.DistanceRateId
            })
            .ToListAsync();
    }

    private async Task<IEnumerable<AgentViewModel>> ProcessAgentsInParallelAsync(JobDetails job,
        List<AgentInfo> agents)
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
                    var agentRate = await GetAgentRatesAsync(job, agent, ct);
                    var viewModel = new AgentViewModel
                    {
                        AgentId = agent.AgentId,
                        AgentName = agent.AgentName,
                        AgentRanking = agent.AgentRanking,
                        AgentRate = agentRate ?? 0
                    };

                    agentResults.Add(viewModel);
                }
            });

        return agentResults;
    }

    private async Task<decimal?> GetAgentRatesAsync(JobDetails job,
        AgentInfo agent, CancellationToken ct)
    {
        var rates = await Context.Procedures.DD_stpGetAgentDistanceRateAsync(
            ClientID: job.ClientId,
            FromZipCode: int.Parse(job.FromZipCode),
            ToZipCode: int.Parse(job.ToZipCode),
            TotalMiles: job.TotalMiles,
            TotalWeight: job.TotalWeight,
            TotalPallets: null,
            ExtraStopOffs: null,
            BookTime: job.BookTime,
            VehicleSizeID: job.VehicleSizeId,
            DangerousGoods: job.DangerousGoods,
            DryIceWeight: job.DryIceWeight,
            WaitTime: null,
            DistanceRateID: agent.DistanceRateId,
            cancellationToken: ct
        );

        return rates
            .Select(r => r.Rate)
            .FirstOrDefault();
    }

    private class JobDetails
    {
        public int? AirPortId { get; init; }
        public int? VehicleSizeId { get; init; }
        public int? ClientId { get; init; }
        public string FromZipCode { get; init; }
        public string ToZipCode { get; init; }
        public int? TotalMiles { get; init; }
        public decimal? TotalWeight { get; init; }
        public DateTime? BookTime { get; init; }
        public bool? DangerousGoods { get; init; }
        public decimal? DryIceWeight { get; init; }
    }

    private class AgentInfo
    {
        public int AgentId { get; init; }
        public string AgentName { get; init; }
        public string AgentRanking { get; init; }
        public int? DistanceRateId { get; init; }
    }
}