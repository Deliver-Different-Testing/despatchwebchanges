using AutoMapper;
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

public class NationwideJobRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), INationwideJobRepository
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
            ConNote = j.ConNote,
            AirportOnly = j.AirportOnly,
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
                    j.ParentId
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
                    whereClause.Append(windowPane == NationwideWindowPanel.Reprice ? "Reprice = 1" : "ucjbJobDone = 0");
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
                            whereClause.Append("Reprice = 1");
                            break;
                        default:
                            whereClause.Append(string.Empty);
                            break;
                    }

                    break;
                case "done":
                    whereClause.Append(windowPane == NationwideWindowPanel.Reprice ? "Reprice = 1" : "ucjbJobDone = 1");
                    break;
            }
        }

        if (whereClause.Length > 0) whereClause.Append(" AND ");

        switch (windowPane)
        {
            case NationwideWindowPanel.JobList:
                whereClause.Append("(InternalStatus = 1 OR (InternalStatus is Null AND ucjbStatus <> 9))");
                break;
            case NationwideWindowPanel.Pod:
                whereClause.Append("(InternalStatus = 3 OR ucjbStatus = 9)");
                break;
            case NationwideWindowPanel.ActionRequired:
                whereClause.Append("(InternalStatus = 2)");
                break;
            case NationwideWindowPanel.Reprice:
                whereClause.Append("(ucjbStatus = 6)");
                break;
            default:
                whereClause.Append(string.Empty);
                break;
        }

        if (!isInternal && !string.IsNullOrEmpty(clientIds)) whereClause.Append($" AND ucjbClientID in ({clientIds})");

        return whereClause.ToString();
    }
}
