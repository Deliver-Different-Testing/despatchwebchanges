using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
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

public class NationwideJobRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), INationwideJobRepository
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

        // Build filters
        var orderByClause = GetNationwideOrderByClause(order, ascending);
        var whereClause = BuildNationwideWhereClause(isInternal, viewFilters, status, windowPane, clientIds);

        var sql =
            $"select *, null as CourierLatitude, null as CourierLongitude from DESWEB_qryDespatch where {whereClause} order by {orderByClause}";
        Log.Information($"Executing SQL: {sql}");

        var jobs = await Context.DeswebQryDespatches.FromSqlRaw(sql)
            .AsNoTracking()
            .ToListAsync();

        var list = jobs.Select(j => new JobViewModel
        {
            Id = j.UcjbId,
            Time = j.UcjbTime,
            Direct = j.Direct,
            Van = j.UcjbVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            Return = j.UcjbReturn,
            PickupFrom = j.UcjbPickUpFrom,
            SaturdayDelivery = j.SaturdayDelivery,
            JobNo = j.UcjbNumber,
            Speed = j.SpeedShortName,
            SpeedName = j.SpeedName,
            NotifiedName = j.NotifiedName,
            AcceptedName = j.OriginalName,
            SpeedId = j.UcjbSpeed,
            Notify = j.NotifiedSpeed,
            AcceptedJobTypeId = j.AcceptedJobTypeId,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            Vehicle = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan
                    ? "Van"
                    : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
            },
            Client = j.UcclCode,
            ClientId = j.UcjbClientId,
            ClientName = j.ClientName,
            JobType = (int)(j.UcjbType ?? 0),
            FromContactName = j.PickupFromContact,
            FromContactNumber = j.PickupFromPhone,
            PickupAddress = new AddressViewModel
            {
                AddressLine1 = j.PickupAddressLine1,
                AddressLine2 = j.PickupAddressLine2,
                AddressLine3 = j.PickupAddressLine3,
                AddressLine4 = j.PickupAddressLine4,
                AddressLine5 = j.PickupAddressLine5,
                AddressLine6 = j.PickupAddressLine6,
                AddressLine7 = j.PickupAddressLine7,
                AddressLine8 = j.PickupAddressLine8,
                Latitude = j.PickUpLatitude,
                Longitude = j.PickUpLongitude,
            },
            DeliveryAddress = new AddressViewModel
            {
                AddressLine1 = j.DeliveryAddressLine1,
                AddressLine2 = j.DeliveryAddressLine2,
                AddressLine3 = j.DeliveryAddressLine3,
                AddressLine4 = j.DeliveryAddressLine4,
                AddressLine5 = j.DeliveryAddressLine5,
                AddressLine6 = j.DeliveryAddressLine6,
                AddressLine7 = j.DeliveryAddressLine7,
                AddressLine8 = j.DeliveryAddressLine8,
                Latitude = j.DeliveryLatitude,
                Longitude = j.DeliveryLongitude,
            },
            From = j.SuburbFrom,
            FromSuburbId = j.FromSuburbId,
            FromSuburbName = j.FromSuburbName,
            FromPostCode = j.FromPostCode,
            FromAddress = j.UcjbFromAddr,
            To = j.SuburbTo,
            ToSuburbId = j.ToSuburbId,
            ToSuburbName = j.ToSuburbName,
            ToPostCode = j.ToPostCode,
            ToAddress = j.UcjbToAddr,
            ToCity = j.ToCity,
            Courier = j.CourierCode,
            Remain = j.RemainTime,
            StatusId = j.UcjbStatus,
            Status = j.UcjsCode,
            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,
            ContactName = j.UcjbContact,
            Phone = j.DeliverToPhone,
            SpeedAccepted = j.OriginalSpeed,
            Size = new Vehicle
            {
                Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                Label = j.UcjbVan
                    ? "Van"
                    : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
            },
            Weight = j.UcjbWeight,
            Items = j.UcjbQty,
            RefA = j.UcjbClientRefa,
            RefB = j.UcjbClientRefb,
            OurRef = j.UcjbOurRef,
            SigNotRequired = j.SigNotRequired,
            Charge = $"{j.UcjbAmount:C}",
            Booked = j.UcjbTime.HasValue
                ? DateTime.Parse(j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss"))
                : DateTime.Now,
            Date = j.UcjbDate.ToString("dd/MM/yyyy"),
            DispatchTime = j.UcjbDispTime,
            PuTime = j.Putime,
            ClientNotes = j.ClientNotes,
            InternalNotes = j.JobNotes,
            ChildNotes = j.ChildNotes,
            PalletInfo = (
                from pa in Context.TucJobItems.Where(p => p.JobId == j.UcjbId)
                select new PalletInfo
                {
                    Id = pa.JobId,
                    Quantity = pa.Items,
                    ItemId = pa.ItemId,
                    Weight = pa.Weight,
                    Length = pa.Length,
                    Depth = pa.Depth,
                    Height = pa.Height,
                    Pu = pa.Pu,
                    Do = pa.Do,
                    DgClass = pa.Dgclass,
                    Notes = pa.Notes
                }).ToList(),
            CourierData = new CourierData
            {
                Courier = string.IsNullOrEmpty(j.CourierCode) ? "" : j.CourierCode + " " + j.CourierName,
                CourierId = j.UcjbCourierId
            },
            AllowDispatch = j.AllowDespatch,
            AllowSplit = j.AllowSplit,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,
            DisplaySplitJobDetail = j.DisplaySplitJobDetail == 1,
            TruckWeightLimit = j.TruckWeightLimit,
            TruckStartTime = j.TruckStartTime,
            TruckHours = j.TruckHours,
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            PickupTime = j.PickupTime,
            DeliveryTime = j.DeliveryTime,
            AlertLatePickup = j.AlertLatePickUp,
            AlertLateDelivery = j.AlertLateDelivery,
            Minutes = j.Minutes,
            DeliverToContact = j.DeliverToContact,
            PodPhoto = j.DeliveryPhoto,
            PodName = j.UcjbPodname,
            CompletedTime = j.UcjbComplTime.HasValue
                ? DateTime.Parse(j.UcjbComplTime?.ToString("yyyy-MM-dd") + " " +
                                 j.UcjbComplTime?.ToString("HH:mm"))
                : j.UcjbComplTime,
            Done = j.UcjbJobDone,
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,
            UdStatus = j.Udstatus,
            RatedManually = j.RatedManually,
            PreBook = false,
            Attention = j.UcjbAttention,
            Pedal = j.UcjbCbd,
            Locked = j.Locked ?? false,
            Invoiced = false,
            InternalStatusId = j.InternalStatus,
            Reprice = j.Reprice,
            FollowupTime = j.FollowupTime,
            RootParentId = j.RootParentId,
            ScheduleName = j.ScheduleName,
            ConNote = j.ConNote.ToString(),
            AirportOnly = bool.TryParse(j.AirportOnly?.ToString(), out bool airportOnly) && airportOnly,
            HasNationwide = j.HasNationwide.HasValue,
            LoggedInContactName = j.LoggedInContactName,
            StatusName = j.StatusName,
            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId
        }).ToList();

        foreach (var job in list)
        {
            job.AssignedFlight = await Context.TucJobNationwides
                .Where(nj => nj.UcnwJobId == job.Id)
                .Select(nj => new AssignedFlight
                {
                    ExpectedArrival = nj.UcnwEta,
                    ExpectedDeparture = nj.UcnwEtd,
                    FlightNumber = nj.UcnwFlightNo,
                    Notes = nj.UcnwNotes
                })
                .FirstOrDefaultAsync();
        }

        return list;
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
            await Context.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            // Log the exception
            Console.WriteLine(ex.Message);
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
                AgentId = agentId
            };

            Context.TucJobs.Attach(jobToUpdate);
            Context.Entry(jobToUpdate).Property(x => x.AgentId).IsModified = true;

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


    private static string GetNationwideOrderByClause(string order, string ascending)
    {
        var ascDesc = ascending?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true ? "ASC" : "DESC";

        return order?.ToLowerInvariant() switch
        {
            "courier" => $"Convert(int, CourierCode) {ascDesc}, ucjbtime {ascDesc}",
            "remain" => $"FollowupTime {ascDesc},  ucjbDispTime {ascDesc}, Remaintime {ascDesc}, ucjbtime {ascDesc}",
            "to" =>
                $"SuburbTo {ascDesc}, ucjbTime {ascDesc}, SuburbFrom {ascDesc}, Convert(int, CourierCode) {ascDesc}",
            "from" =>
                $"SuburbFrom {ascDesc}, SuburbTo {ascDesc}, ucjbTime {ascDesc}, Convert(int, CourierCode) {ascDesc}",
            "client" => $"ucclCode {ascDesc}, ucjbTime {ascDesc}, Convert(int, CourierCode) {ascDesc}",
            "jobno" => $"ucjbNumber {ascDesc}, ucjbTime {ascDesc}, Convert(int, CourierCode) {ascDesc}",
            "status" => $"ucjbStatus {ascDesc}",
            "speed" => $"SpeedShortName {ascDesc}",
            "notify" => $"NotifiedSpeed {ascDesc}",
            "lp" => $"ucjbLatePick {ascDesc}",
            "ld" => $"ucjbLateDel {ascDesc}",
            "time" => $"ucjbTime {ascDesc}, Convert(int,CourierCode) {ascDesc}",
            "pod" => $"ucjbPODName {ascDesc}, Convert(int, CourierCode) {ascDesc}",
            _ =>
                $"FollowupTime {ascDesc}, ucjbDispTime {ascDesc}, ucjbTime {ascDesc}, Convert(int, CourierCode) {ascDesc}"
        };
    }

    private static string BuildNationwideWhereClause(bool isInternal, List<string> filter, string status,
        NationwideWindowPanel windowPane, string clientIds)
    {
        var whereClause = new StringBuilder();

        if (isInternal)
        {
            if (filter != null && filter.Any())
            {
                whereClause.Append('(');
                whereClause.Append(string.Join(" OR ", filter.Select(where => $"({where})")));
                whereClause.Append(')');
            }
        }

        if (!string.IsNullOrEmpty(status))
        {
            if (whereClause.Length > 0) whereClause.Append(" AND ");

            switch (status)
            {
                case "all":
                    whereClause.Append(windowPane == NationwideWindowPanel.Reprice
                        ? "(Reprice = 1 OR InternalStatus = " + (int)InternalJobStatus.Reprice + ")"
                        : "ucjbJobDone = 0");
                    break;
                case "active":
                    switch (windowPane)
                    {
                        case NationwideWindowPanel.JobList:
                            whereClause.Append("ucjbJobDone = 0");
                            break;
                        case NationwideWindowPanel.Pod:
                        case NationwideWindowPanel.ActionRequired:
                            whereClause.Append("ucjbJobDone = 0 AND FollowupTime < GETDATE()");
                            break;
                        case NationwideWindowPanel.Reprice:
                            whereClause.Append("(Reprice = 1 OR InternalStatus = " + (int)InternalJobStatus.Reprice +
                                               ")");
                            break;
                        default:
                            whereClause.Append(string.Empty);
                            break;
                    }

                    break;
                case "done":
                    whereClause.Append(windowPane == NationwideWindowPanel.Reprice
                        ? "(Reprice = 1 OR InternalStatus = " + (int)InternalJobStatus.Reprice + ")"
                        : "ucjbJobDone = 1");
                    break;
            }
        }

        if (whereClause.Length > 0) whereClause.Append(" AND ");

        switch (windowPane)
        {
            case NationwideWindowPanel.JobList:
                whereClause.Append(
                    $"(InternalStatus = {(int)InternalJobStatus.NewJobs} OR (InternalStatus is Null AND ucjbStatus <> 9))");
                break;
            case NationwideWindowPanel.Pod:
                whereClause.Append($"(InternalStatus = {(int)InternalJobStatus.AwaitingPod} OR ucjbStatus = 9)");
                break;
            case NationwideWindowPanel.ActionRequired:
                whereClause.Append($"(InternalStatus = {(int)InternalJobStatus.BookDelivery})");
                break;
            case NationwideWindowPanel.Reprice:
                whereClause.Append($"(InternalStatus = {(int)InternalJobStatus.Reprice} OR Reprice = 1)");
                break;
            default:
                whereClause.Append(string.Empty);
                break;
        }

        if (!isInternal && !string.IsNullOrEmpty(clientIds)) whereClause.Append($" AND ucjbClientID in ({clientIds})");

        return whereClause.ToString();
    }


    /*
    private async Task<List<JobViewModel>> DespatchQry()
    {
        var excludedSpeeds = new int?[] { 38, 39, 55, 56 };
        var specialSpeeds = new int?[] { 53, 54 };
        var specialClients = new[] { "UCLHP", "UCLHR" };

        var jobs = await _context.TucJobs
            .Where(j => !j.UcjbVoid
                        && j.ParentId != null
                        && j.UcjbStatus != 18
                        && (j.JobRelationshipType.DisplayDespatch == true ||
                            (j.JobRelationshipTypeId == 10 && !excludedSpeeds.Contains(j.UcjbSpeed)))
                        && (j.DisplayInDespatch == null || j.DisplayInDespatch == true)
                        && (j.UcjbDate.Date <= DateTime.Today ||
                            specialSpeeds.Contains(j.UcjbSpeed) ||
                            specialClients.Contains(j.UcjbClientCode)))
            .Select(j => new JobViewModel
            {
                ClientId = j.UcjbId,
                Id = j.UcjbId,
                JobNo = j.UcjbNumber,
                Time = j.UcjbTime,
                PickupTime = j.UcjbSpeedNavigation.PickupTime,
                DeliveryTime = j.UcjbSpeedNavigation.DeliveryTime,

                // Courier
                Courier = j.UcjbCourier.Code,
                CourierData = new CourierData
                {
                    Courier = string.IsNullOrEmpty(j.UcjbCourier.Code)
                        ? ""
                        : j.UcjbCourier.Code + " " + j.UcjbCourier.UccrName,
                    CourierId = j.UcjbCourierId
                },

                // Address information
                PickupAddress = new AddressViewModel
                {
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8,
                    Latitude = j.PickUpLatitude,
                    Longitude = j.PickUpLongitude,
                },
                DeliveryAddress = new AddressViewModel
                {
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8,
                    Latitude = j.DeliveryLatitude,
                    Longitude = j.DeliveryLongitude,
                },

                // Airport information
                ToAirportId = j.ToAirportId,
                FromAirportId = j.FromAirportId,

                // Assigned flight information
                AssignedFlight = j.TucJobNationwides.Select(nj => new AssignedFlight
                {
                    ExpectedArrival = nj.UcnwEta,
                    ExpectedDeparture = nj.UcnwEtd,
                    FlightNumber = nj.UcnwFlightNo,
                    Notes = nj.UcnwNotes
                }).FirstOrDefault(),

                // Assigned agent
                AssignedAgent = new AgentViewModel
                {
                    AgentId = j.Agent.UcagId,
                    AgentName = j.Agent.UcagName,
                    AgentRanking = j.Agent.Ranking.AgentRankingName,
                },

                // Notes
                ClientNotes = j.UcjbClient.UcclNotes,
                InternalNotes = j.InternalNotes,
                ChildNotes = j.UcjbNotes,

                // Suburb information
                From = j.UcjbFromNavigation.UcsuName ?? "Unknown",
                FromSuburbName = j.UcjbFromNavigation.UcsuName,
                FromPostCode = j.UcjbFromNavigation.PostCode,
                FromAddress = j.UcjbFromAddr,
                To = j.UcjbToNavigation.UcsuName ?? "Unknown",
                ToSuburbName = j.UcjbToNavigation.UcsuName,
                ToPostCode = j.UcjbToNavigation.PostCode,
                ToCity = j.UcjbToNavigation.City,

                // Region information
                FromSuburbId = j.UcjbFromNavigation.UcsuId,
                ToSuburbId = j.UcjbToNavigation.UcsuId,

                // Delivery details
                PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
                Return = j.UcjbReturn,
                SaturdayDelivery = j.SaturdayDelivery,

                // Location data
                PickUpLatitude = j.PickUpLatitude,
                PickUpLongitude = j.PickUpLongitude,
                DeliveryLatitude = j.DeliveryLatitude,
                DeliveryLongitude = j.DeliveryLongitude,

                // Client information
                Client = j.UcjbClientCode,
                ClientName = j.UcjbClient.UcclName,

                // Job characteristics
                Weight = j.UcjbWeight,
                ToAddress = j.UcjbToAddr,
                JobType = (int)(j.UcjbType ?? 0),
                Direct = j.Direct,
                Van = j.UcjbVan,
                VanOk = j.VanOk,
                Truck = j.Truck,

                // Job status and details
                Done = j.UcjbJobDone,
                AlertLatePickup = j.UcjbClient.AlertLatePickUp,
                AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
                Lp = j.UcjbLatePick,
                Ld = j.UcjbLateDel,

                PickupFrom = j.UcjbPickUpFrom,
                Notify = j.NotifiedJobType.UcjtName,
                FromContactName = j.PickupFromContact,
                FromContactNumber = j.PickupFromPhone,

                // Speed and job type information
                Speed = j.UcjbSpeedNavigation.ShortName,
                SpeedName = j.UcjbSpeedNavigation.UcjtName,
                NotifiedName = j.NotifiedJobType.UcjtName,
                AcceptedName = j.AcceptedJobType.UcjtName,
                SpeedId = j.UcjbSpeed,
                NotifiedJobTypeId = j.NotifiedJobTypeId,
                AcceptedJobTypeId = j.AcceptedJobTypeId,

                // References and amounts
                RefA = j.UcjbClientRefa,
                RefB = j.UcjbClientRefb,
                Charge = $"{j.UcjbAmount:C}",
                OurRef = j.UcjbOurRef,

                // Status
                StatusId = j.UcjbStatusNavigation.UcjsId,
                Status = j.UcjbStatusNavigation.UcjsCode,
                StatusName = j.UcjbStatusNavigation.UcjsName,

                // Vehicle
                Vehicle = new Vehicle
                {
                    Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                    Label = j.UcjbVan
                        ? "Van"
                        : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                },
                Size = new Vehicle
                {
                    Id = j.UcjbVan ? (short?)Enums.Vehicle.Van : j.UcjbSize,
                    Label = j.UcjbVan
                        ? "Van"
                        : Enum.GetName(typeof(Enums.Vehicle), (int)(j.UcjbSize ?? 2))
                },

                // Job items
                PalletInfo = j.TucJobItems.Select(i => new PalletInfo
                {
                    Id = i.JobId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length,
                    Depth = i.Depth,
                    Height = i.Height,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }).ToList(),
            }).AsNoTracking().ToListAsync();

        return jobs;
    }
    */


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
