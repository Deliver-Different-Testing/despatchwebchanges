using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using DespatchWeb.Constants;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.EntityFrameworkCore;
using Serilog;
using CourierLocation = DespatchWeb.Models.Response.CourierLocation;

namespace DespatchWeb.Repositories;

public class BaseJobRepository(IDbContextFactory<DespatchContext> contextFactory, ITenantTimeService timeService)
    : BaseRepository(contextFactory)
{
    protected static readonly Expression<Func<TucJob, JobViewModel>> JobMapping =
        j => new JobViewModel
        {
            ClientId = j.UcjbClientId,
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            Time = j.UcjbTime,
            RootParentId = j.RootParentId,
            Date = j.UcjbDate.ToString("MM/dd/yyyy"),
            Booked = DateTime.Parse(
                j.UcjbDate.ToString("yyyy-MM-dd") + " " + j.UcjbTime.Value.ToString("HH:mm:ss")
            ),
            DispatchTime = j.UcjbDispTime,
            CreatedDate = j.UcjbDate,
            ScheduleName = j.ScheduleName,
            FollowupTime = j.FollowupTime,
            Void = j.UcjbVoid,

            PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
            DeliveryTime =
                j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

            // Courier
            Courier = j.UcjbCourierId != null ? j.UcjbCourier.Code : null,
            CourierData =
                j.UcjbCourierId != null
                    ? new CourierData
                    {
                        Courier = j.UcjbCourier.Code,
                        CourierId = j.UcjbCourierId,
                        CourierMobile = j.UcjbCourier.UccrMobile,
                        CourierName = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                    }
                    : null,
            AssignedCourier =
                j.UcjbCourier != null
                    ? new Suggestion
                    {
                        Id = j.UcjbCourier.UccrId,
                        Text = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                    }
                    : null,

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
                Longitude = j.PickUpLongitude
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
                Longitude = j.DeliveryLongitude
            },

            // Airport information
            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

            // Assigned flight information
            AssignedFlight = j
                .TucJobNationwides.Select(nj => new AssignedFlight
                {
                    ExpectedArrival = nj.UcnwEta,
                    ExpectedDeparture = nj.UcnwEtd,
                    FlightNumber = nj.UcnwFlightNo,
                    Notes = nj.UcnwNotes
                })
                .FirstOrDefault(),

            // Assigned agent
            AssignedAgent =
                j.Agent != null
                    ? new AgentViewModel
                    {
                        AgentId = j.Agent.UcagId,
                        AgentName = j.Agent.UcagName,
                        AgentRanking =
                            j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : null
                    }
                    : null,

            // Suburb information
            From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : "Unknown",
            FromSuburbName = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
            FromPostCode = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.PostCode : null,
            FromAddress = j.UcjbFromAddr,
            To = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : "Unknown",
            ToSuburbName = j.UcjbToNavigation != null ? j.UcjbToNavigation.UcsuName : null,
            ToPostCode = j.UcjbToNavigation != null ? j.UcjbToNavigation.PostCode : null,
            ToCity = j.UcjbToNavigation != null ? j.UcjbToNavigation.City : null,

            // Region information
            FromSuburbId = j.UcjbFromNavigation.UcsuId,
            ToSuburbId = j.UcjbToNavigation.UcsuId,

            // Tracking info
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,

            // Delivery details
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            Return = j.UcjbReturn,
            SaturdayDelivery = j.SaturdayDelivery,
            Remain = CalculateRemainTime(j, j.UcjbSpeedNavigation),
            CompletedTime = j.UcjbComplTime,
            UdStatus = j.UndeliverableLocation.Name,
            SigNotRequired = j.DeliverToLeave.Name,
            DeliverToLeaveId = j.DeliverToLeaveId,
            DeliverToContact = j.DeliverToContact,

            // Location data
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            // Client information
            Client = j.UcjbClientCode,
            ClientName = j.UcjbClient.UcclName,
            ToContactPhone = j.DeliverToPhone,
            PodName = j.UcjbPodname,
            PuTime = j.PickUpTime,

            // Job characteristics
            Weight = j.UcjbWeight,
            ToAddress = j.UcjbToAddr,
            JobType = (int)(j.UcjbType ?? 0),
            Direct = j.Direct,
            Van = j.UcjbVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,
            ParcelDimensions = j
                .TucJobItems.Select(p => new ParcelDimensions
                {
                    ItemId = p.ItemId,
                    ItemName = p.Notes,
                    Height = p.Height,
                    Depth = p.Depth,
                    Length = p.Length
                })
                .ToList(),

            // Job status and details
            Done = j.UcjbJobDone,
            AlertLatePickup = j.UcjbClient.AlertLatePickUp,
            AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,
            Items = j.UcjbQty,

            PickupFrom = j.UcjbPickUpFrom,
            Notify = j.NotifiedJobType.UcjtName,
            FromContactName = j.PickupFromContact,
            FromContactNumber = j.PickupFromPhone,

            // Speed and job type information
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
            SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.UcjtName : null,
            NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
            AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
            SpeedId = j.UcjbSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcjbClientRefa,
            RefB = j.UcjbClientRefb,
            Charge = $"${j.PricingBreakdowns.Sum(p => p.ChargeAmount):F2}",
            OurRef = j.UcjbOurRef,

            // Status
            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            InternalStatusId = j.InternalStatus,

            // Checkboxes
            Reprice = j.InternalStatus == (int)InternalJobStatus.Reprice,

            // Size
            Size =
                j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName
                    }
                    : null,

            // Job items
            PalletInfo = j
                .TucJobItems.Select(i => new PalletInfo
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
                })
                .ToList(),

            // Related jobs
            RelatedJobs = j
                .Parent.InverseParent.Select(p => new Suggestion
                {
                    Id = p.UcjbId,
                    Text = p.UcjbNumber
                })
                .ToList(),

            IsArchived = false,
            PreBook = false,
            DeliverByTime = j.DeliverByTime,
        };

    private static readonly Expression<Func<TucJobArchive, JobViewModel>> JobArchiveMapping =
        j => new JobViewModel
        {
            ClientId = j.UcjbClientId,
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            Time = j.UcjbTime,
            RootParentId = j.RootParentId,
            Date = j.UcjbDate.HasValue ? j.UcjbDate.Value.ToString("MM/dd/yyyy") : null,
            Booked =
                j.UcjbDate.HasValue && j.UcjbTime.HasValue
                    ? DateTime.Parse(
                        j.UcjbDate.Value.ToString("yyyy-MM-dd")
                        + " "
                        + j.UcjbTime.Value.ToString("HH:mm:ss")
                    )
                    : DateTime.MinValue,
            DispatchTime = j.UcjbDispTime,
            CreatedDate = j.UcjbDate,
            ScheduleName = j.ScheduleName,
            FollowupTime = j.FollowupTime,
            Void = j.UcjbVoid,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.UcjbCourierId.HasValue
                ? new CourierData { CourierId = j.UcjbCourierId }
                : null,
            AssignedCourier = j.UcjbCourierId.HasValue
                ? new Suggestion { Id = j.UcjbCourierId.Value }
                : null,

            // Address information - directly available in archive
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
                Longitude = j.PickUpLongitude
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
                Longitude = j.DeliveryLongitude
            },

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

            AssignedFlight = null,

            AssignedAgent =
                j.Agent != null
                    ? new AgentViewModel { AgentId = j.Agent.UcagId, AgentName = j.Agent.UcagName }
                    : null,

            FromSuburbId = j.UcjbFrom,
            ToSuburbId = j.UcjbTo,

            // Tracking info
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,

            // Delivery details
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            Return = j.UcjbReturn,
            SaturdayDelivery = j.SaturdayDelivery,
            CompletedTime = j.UcjbComplTime,
            DeliverToLeaveId = j.DeliverToLeaveId,
            DeliverToContact = j.DeliverToContact,

            // Location data
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            // Client information
            Client = j.UcjbClientCode,
            ToContactPhone = j.DeliverToPhone,
            PodName = j.UcjbPodname,
            PuTime = j.PickUpTime,

            // Job characteristics
            Weight = j.UcjbWeight,
            ToAddress = j.UcjbToAddr,
            JobType = (int)(j.UcjbType ?? 0),
            Direct = j.Direct,
            Van = j.UcjbVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,

            // Job status and details
            Done = j.UcjbJobDone,
            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,
            Items = j.UcjbQty,

            PickupFrom = j.UcjbPickUpFrom,
            FromContactName = j.PickUpFromContact,

            // Speed and job type information
            SpeedId = j.UcjbSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcjbClientRefa,
            RefB = j.UcjbClientRefb,
            Charge = j.UcjbAmount.HasValue ? $"{j.UcjbAmount:C}" : null,
            OurRef = j.UcjbOurRef,

            StatusId = j.UcjbStatus,
            InternalStatusId = j.InternalStatus,

            // Checkboxes
            Reprice = j.InternalStatus == (int)InternalJobStatus.Reprice,

            // Size - has navigation in archive
            Size =
                j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName
                    }
                    : null,
            IsArchived = true,
            PreBook = false,
            DeliverByTime = j.DeliverByTime,
        };

    private static readonly Expression<Func<TucJobBooking, JobViewModel>> JobPrebookMapping =
        j => new JobViewModel
        {
            ClientId = j.UcbkClientId,
            Id = j.UcbkId,
            JobNo = j.UcbkJobNumber,
            Time = j.UcbkTime,
            RootParentId = j.RootParentId,
            Date = j.UcbkDate.HasValue ? j.UcbkDate.Value.ToString("MM/dd/yyyy") : null,
            Booked =
                j.UcbkDate.HasValue && j.UcbkTime.HasValue
                    ? DateTime.Parse(
                        j.UcbkDate.Value.ToString("yyyy-MM-dd")
                        + " "
                        + j.UcbkTime.Value.ToString("HH:mm:ss")
                    )
                    : DateTime.MinValue,
            CreatedDate = j.UcbkDate,
            ScheduleName = j.ScheduleName,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.CourierId.HasValue
                ? new CourierData { CourierId = j.CourierId }
                : null,
            AssignedCourier = j.CourierId.HasValue
                ? new Suggestion { Id = j.CourierId.Value }
                : null,

            // Address information - directly available in archive
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
                Longitude = j.PickUpLongitude
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
                Longitude = j.DeliveryLongitude
            },

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

            AssignedFlight = null,

            // Notes
            Notes = j.TucNotes.Select(note => new TucNoteViewModel(note)).ToList(),

            FromSuburbId = (int)j.UcbkFrom,
            ToSuburbId = (int)j.UcbkTo,

            // Tracking info
            TrackingMethod = j.TrackingMethod,
            TrackingMobile = j.TrackingMobile,
            TrackingEmail = j.TrackingEmail,

            // Delivery details
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            Return = j.UcbkReturn,
            SaturdayDelivery = j.SaturdayDelivery,
            DeliverToLeaveId = j.DeliverToLeaveId,
            DeliverToContact = j.DeliverToContact,

            // Location data
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            // Client information
            Client = j.UcbkClientCode,
            ToContactPhone = j.DeliverToPhone,

            // Job characteristics
            Weight = j.UcbkWeight,
            ToAddress = j.UcbkToAddr,
            JobType = (int)(j.UcbkType ?? 0),
            Direct = j.Direct,
            Van = j.UcbkVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,

            // Job status and details
            Done = j.UcbkDone,
            Items = j.Quantity,

            PickupFrom = (short)j.UcbkPickUpFrom,
            FromContactName = j.PickupFromContact,

            // Speed and job type information
            SpeedId = j.UcbkSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcbkClientRefa,
            RefB = j.UcbkClientRefb,
            Charge = $"${j.PricingBreakdowns.Sum(p => p.ChargeAmount):F2}",
            OurRef = j.UcbkOurRef,

            // Size - has navigation in archive
            Size =
                j.UcbkSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcbkSizeNavigation.VehicleSizeId,
                        Text = j.UcbkSizeNavigation.VehicleName
                    }
                    : null,
            IsArchived = true,
            PreBook = true,
            DeliverByTime = j.DeliverByTime
        };

    private static readonly int[] SourceArray = [41, 42, 43, 51, 52];

    // Create
    public async Task<T> Add<T>(T entity)
        where T : class
    {
        var result = await Context.Set<T>().AddAsync(entity);
        await Context.SaveChangesAsync();
        return result.Entity;
    }

    protected async Task<T> Get<T>(int id)
        where T : class => await Context.Set<T>().FindAsync(id);

    // This function replaces the sql view "DESWEB_qryDespatch"
    protected async Task<List<JobViewModel>> DespatchQry(
        AppPage page,
        string order,
        string orderDirection,
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds,
        NationwideWidget? windowPane = null,
        ClearListEnvelopeViewModel clearListEnvelope = null,
        DateTime? dateCutoff = null
    )
    {
        try
        {
            var query = await BuildBaseQuery(selectedViewIds);
            if (query == null) return [];

            query = ApplyGeographicFilters(query, clearListEnvelope);

            switch (page)
            {
                case AppPage.Dispatch:
                    // Filters
                    query = query.Where(j => j.UcjbStatus != 9);
                    if (dateCutoff.HasValue) query = query.Where(j => j.UcjbDate <= dateCutoff.Value.Date);

                    // Sorting
                    query = ApplyDashboardSpecificOrdering(
                        query,
                        order,
                        orderDirection,
                        isUsTenant
                    );
                    break;
                case AppPage.Domestic:
                    query = ApplyNationwideSpecificFilters(
                        query,
                        isInternal,
                        windowPane ?? NationwideWidget.JobList,
                        clientIds
                    );
                    query = ApplyNationwideSpecificOrdering(query, order, orderDirection);
                    break;
                case AppPage.JobSearch:
                case AppPage.Prebooks:
                default:
                    return [];
            }

            var sql = query.ToQueryString();
            Log.Information($"Generated SQL: {sql}");

            var jobs = await query
                .Select(JobMapping)
                .AsNoTracking()
                .ToListAsync();

            return jobs;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occured getting jobs for dispatch page. Please see exception.");
            throw;
        }
    }

    private async Task<IQueryable<TucJob>> BuildBaseQuery(List<int> selectedViews)
    {
        var jobIds = await GetFilteredJobIds(selectedViews);
        return jobIds.Count == 0 ? null : Context.TucJobs.Where(j => jobIds.Contains(j.UcjbId));
    }

    private async Task<List<int>> GetFilteredJobIds(List<int> selectedViewIds)
    {
        if (selectedViewIds == null || selectedViewIds.Count == 0)
        {
            return await Context
                .DeswebQryDespatchJobViewFilters.Select(x => x.UcjbId)
                .ToListAsync();
        }

        var viewFilters =
            selectedViewIds.Count != 0
                ? await Context
                    .TblDespatchViews.Where(dv => selectedViewIds.Contains(dv.DespatchViewId))
                    .Select(dv => dv.WhereCondition)
                    .ToListAsync()
                : [];

        var combinedFilters = string.Join(" OR ", viewFilters.Select(filter => $"({filter})"));
        return await Context
            .DeswebQryDespatchJobViewFilters.FromSqlRaw(
                $"select * from DESWEB_qry_Despatch_Job_View_Filters WHERE {combinedFilters}"
            )
            .Select(x => x.UcjbId)
            .ToListAsync();
    }

    private static IQueryable<TucJob> ApplyGeographicFilters(
        IQueryable<TucJob> query,
        ClearListEnvelopeViewModel clearListEnvelope
    )
    {
        if (clearListEnvelope == null)
            return query;

        return query.Where(j =>
            j.DeliveryLatitude >= clearListEnvelope.MinimumLatitude
            && j.DeliveryLatitude <= clearListEnvelope.MaximumLatitude
            && j.DeliveryLongitude >= clearListEnvelope.MinimumLongitude
            && j.DeliveryLongitude <= clearListEnvelope.MaximumLongitude
        );
    }

    private static IQueryable<TucJob> ApplyDashboardSpecificOrdering(
        IQueryable<TucJob> query,
        string order,
        string orderDirection,
        bool isUsTenant
    )
    {
        if (string.IsNullOrEmpty(order))
            return query;

        var isAscending = orderDirection?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true;

        return order.ToLowerInvariant() switch
        {
            // Status group ordering cases
            "group-pending" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.New ? 1 :
                j.UcjbStatus == (int)JobStatus.Dispatched ? 2 :
                j.UcjbStatus == (int)JobStatus.ReadyForPacking ? 3 :
                j.UcjbStatus == (int)JobStatus.ReadyToPickup ? 4 :
                j.UcjbStatus == (int)JobStatus.AwaitingProcessing ? 5 :
                j.UcjbStatus == (int)JobStatus.Preassigned ? 6 : 99
            ).ThenBy(j => j.UcjbTime),

            "group-in-transit" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Accepted ? 1 :
                j.UcjbStatus == (int)JobStatus.PickedUp ? 2 :
                j.UcjbStatus == (int)JobStatus.InTransit ? 3 :
                j.UcjbStatus == (int)JobStatus.OutForDelivery ? 4 : 99
            ).ThenBy(j => j.UcjbTime),

            "group-completed" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Completed ? 1 :
                j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 2 : 99
            ).ThenByDescending(j => j.UcjbTime),

            "group-problem" => query.OrderBy(j =>
                j.UcjbStatus == (int)JobStatus.Rejected ? 1 :
                j.UcjbStatus == (int)JobStatus.LatePickup ? 2 :
                j.UcjbStatus == (int)JobStatus.Warning ? 3 :
                j.UcjbStatus == (int)JobStatus.LateDelivery ? 4 :
                j.UcjbStatus == (int)JobStatus.AwaitingPod ? 5 :
                j.UcjbStatus == (int)JobStatus.Undeliverable ? 6 : 99
            ).ThenBy(j => j.UcjbTime),

            "group-all" => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbTime),

            "remain" => isAscending
                ? query.OrderBy(j => j.UcjbDispTime).ThenBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbDispTime).ThenByDescending(j => j.UcjbTime),

            "to" => isAscending
                ? query
                    .OrderBy(j => isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => isUsTenant ? j.PickupAddressLine5 : j.UcjbFromNavigation.UcsuName)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j =>
                        isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName
                    )
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j =>
                        isUsTenant ? j.PickupAddressLine5 : j.UcjbFromNavigation.UcsuName
                    )
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "from" => isAscending
                ? query
                    .OrderBy(j => isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j =>
                        isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName
                    )
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j =>
                        isUsTenant ? j.DeliveryAddressLine5 : j.UcjbToNavigation.UcsuName
                    )
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "client" => isAscending
                ? query
                    .OrderBy(j => j.UcjbClientCode)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j => j.UcjbClientCode)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "jobno" => isAscending
                ? query
                    .OrderBy(j => j.UcjbNumber)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbCourier.Code)
                : query
                    .OrderByDescending(j => j.UcjbNumber)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbCourier.Code),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatus == (int)JobStatus.New ? 1 :
                    j.UcjbStatus == (int)JobStatus.Preassigned ? 2 :
                    j.UcjbStatus == (int)JobStatus.Dispatched ? 3 :
                    j.UcjbStatus == (int)JobStatus.Accepted ? 4 :
                    j.UcjbStatus == (int)JobStatus.PickedUp ? 5 :
                    j.UcjbStatus == (int)JobStatus.InTransit ? 6 :
                    j.UcjbStatus == (int)JobStatus.OutForDelivery ? 7 :
                    j.UcjbStatus == (int)JobStatus.Rejected ? 8 :
                    j.UcjbStatus == (int)JobStatus.LatePickup ? 9 :
                    j.UcjbStatus == (int)JobStatus.LateDelivery ? 10 :
                    j.UcjbStatus == (int)JobStatus.Warning ? 11 :
                    j.UcjbStatus == (int)JobStatus.Undeliverable ? 12 :
                    j.UcjbStatus == (int)JobStatus.Completed ? 13 :
                    j.UcjbStatus == (int)JobStatus.AwaitingPod ? 14 :
                    j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 15 : 99)
                : query.OrderByDescending(j => j.UcjbStatus == (int)JobStatus.New ? 1 :
                    j.UcjbStatus == (int)JobStatus.Preassigned ? 2 :
                    j.UcjbStatus == (int)JobStatus.Dispatched ? 3 :
                    j.UcjbStatus == (int)JobStatus.Accepted ? 4 :
                    j.UcjbStatus == (int)JobStatus.PickedUp ? 5 :
                    j.UcjbStatus == (int)JobStatus.InTransit ? 6 :
                    j.UcjbStatus == (int)JobStatus.OutForDelivery ? 7 :
                    j.UcjbStatus == (int)JobStatus.Rejected ? 8 :
                    j.UcjbStatus == (int)JobStatus.LatePickup ? 9 :
                    j.UcjbStatus == (int)JobStatus.LateDelivery ? 10 :
                    j.UcjbStatus == (int)JobStatus.Warning ? 11 :
                    j.UcjbStatus == (int)JobStatus.Undeliverable ? 12 :
                    j.UcjbStatus == (int)JobStatus.Completed ? 13 :
                    j.UcjbStatus == (int)JobStatus.AwaitingPod ? 14 :
                    j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 15 : 99),

            "speed" => isAscending
                ? query.OrderBy(j => j.UcjbSpeedNavigation.ShortName)
                : query.OrderByDescending(j => j.UcjbSpeedNavigation.ShortName),

            "notify" => isAscending
                ? query.OrderBy(j => j.NotifiedJobType.UcjtName)
                : query.OrderByDescending(j => j.NotifiedJobType.UcjtName),

            "lp" => isAscending
                ? query.OrderBy(j => j.UcjbLatePick)
                : query.OrderByDescending(j => j.UcjbLatePick),

            "ld" => isAscending
                ? query.OrderBy(j => j.UcjbLateDel)
                : query.OrderByDescending(j => j.UcjbLateDel),

            "time" => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbTime),

            "courier" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.UccrName)
                : query.OrderByDescending(j => j.UcjbCourier.UccrName),

            // Default to time
            _ => isAscending
                ? query.OrderBy(j => j.UcjbTime)
                : query.OrderByDescending(j => j.UcjbTime),
        };
    }

    private static IQueryable<TucJob> ApplyNationwideSpecificFilters(
        IQueryable<TucJob> query,
        bool isInternal,
        NationwideWidget windowPane,
        string clientIds
    )
    {
        // Remove parent jobs
        query = query.Where(j => j.ParentId != null);

        // Apply window pane viewFilters
        query = windowPane switch
        {
            NationwideWidget.JobList => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.NewJobs
                || (j.InternalStatus == null && j.UcjbStatus != 9)
            ),

            NationwideWidget.Pod => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.AwaitingPod || j.UcjbStatus == 9
            ),

            NationwideWidget.ActionRequired => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.ActionRequired
            ),

            NationwideWidget.Reprice => query.Where(j =>
                j.InternalStatus == (int)InternalJobStatus.Reprice || j.Reprice == true
            ),

            _ => query
        };

        // Only get child jobs
        query = query.Where(j => j.ParentId != null);

        // Block out completed jobs from the domestic/nationwide page
        query = query.Where(j => j.UcjbComplTime == null);

        // Apply client viewFilters for non-internal users
        if (isInternal || string.IsNullOrEmpty(clientIds))
            return query;

        var clientIdList = clientIds.Split(',').Select(id => int.Parse(id.Trim())).ToList();
        query = query.Where(j => clientIdList.Contains((int)j.UcjbClientId));

        return query;
    }

    private static IQueryable<TucJob> ApplyNationwideSpecificOrdering(
        IQueryable<TucJob> query,
        string order,
        string orderDirection
    )
    {
        if (string.IsNullOrEmpty(order))
            return query;

        var isAscending = orderDirection?.Equals("asc", StringComparison.OrdinalIgnoreCase) == true;

        return order.ToLowerInvariant() switch
        {
            "courier" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.Code)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbCourier.Code)
                    .ThenByDescending(j => j.UcjbTime),

            "remain" => isAscending
                ? query
                    .OrderBy(j => j.FollowupTime)
                    .ThenBy(j => j.UcjbDispTime)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.FollowupTime)
                    .ThenByDescending(j => j.UcjbDispTime)
                    .ThenByDescending(j => j.UcjbTime),

            "to" => isAscending
                ? query
                    .OrderBy(j => j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                    .ThenBy(j => j.UcjbFromNavigation.UcsuName)
                : query
                    .OrderByDescending(j => j.UcjbToNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbTime)
                    .ThenByDescending(j => j.UcjbFromNavigation.UcsuName),

            "from" => isAscending
                ? query
                    .OrderBy(j => j.UcjbFromNavigation.UcsuName)
                    .ThenBy(j => j.UcjbToNavigation.UcsuName)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbFromNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbToNavigation.UcsuName)
                    .ThenByDescending(j => j.UcjbTime),

            "client" => isAscending
                ? query
                    .OrderBy(j => j.UcjbClient.UcclCode)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbClient.UcclCode)
                    .ThenByDescending(j => j.UcjbTime),

            "jobno" => isAscending
                ? query
                    .OrderBy(j => j.UcjbNumber)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbNumber)
                    .ThenByDescending(j => j.UcjbTime),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatus == (int)JobStatus.New ? 1 :
                    j.UcjbStatus == (int)JobStatus.Preassigned ? 2 :
                    j.UcjbStatus == (int)JobStatus.Dispatched ? 3 :
                    j.UcjbStatus == (int)JobStatus.Accepted ? 4 :
                    j.UcjbStatus == (int)JobStatus.PickedUp ? 5 :
                    j.UcjbStatus == (int)JobStatus.InTransit ? 6 :
                    j.UcjbStatus == (int)JobStatus.OutForDelivery ? 7 :
                    j.UcjbStatus == (int)JobStatus.Rejected ? 8 :
                    j.UcjbStatus == (int)JobStatus.LatePickup ? 9 :
                    j.UcjbStatus == (int)JobStatus.LateDelivery ? 10 :
                    j.UcjbStatus == (int)JobStatus.Warning ? 11 :
                    j.UcjbStatus == (int)JobStatus.Undeliverable ? 12 :
                    j.UcjbStatus == (int)JobStatus.Completed ? 13 :
                    j.UcjbStatus == (int)JobStatus.AwaitingPod ? 14 :
                    j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 15 : 99)
                : query.OrderByDescending(j => j.UcjbStatus == (int)JobStatus.New ? 1 :
                    j.UcjbStatus == (int)JobStatus.Preassigned ? 2 :
                    j.UcjbStatus == (int)JobStatus.Dispatched ? 3 :
                    j.UcjbStatus == (int)JobStatus.Accepted ? 4 :
                    j.UcjbStatus == (int)JobStatus.PickedUp ? 5 :
                    j.UcjbStatus == (int)JobStatus.InTransit ? 6 :
                    j.UcjbStatus == (int)JobStatus.OutForDelivery ? 7 :
                    j.UcjbStatus == (int)JobStatus.Rejected ? 8 :
                    j.UcjbStatus == (int)JobStatus.LatePickup ? 9 :
                    j.UcjbStatus == (int)JobStatus.LateDelivery ? 10 :
                    j.UcjbStatus == (int)JobStatus.Warning ? 11 :
                    j.UcjbStatus == (int)JobStatus.Undeliverable ? 12 :
                    j.UcjbStatus == (int)JobStatus.Completed ? 13 :
                    j.UcjbStatus == (int)JobStatus.AwaitingPod ? 14 :
                    j.UcjbStatus == (int)JobStatus.AssumingCompleted ? 15 : 99),

            "speed" => isAscending
                ? query.OrderBy(j => j.UcjbSpeedNavigation.ShortName)
                : query.OrderByDescending(j => j.UcjbSpeedNavigation.ShortName),

            "notify" => isAscending
                ? query.OrderBy(j => j.NotifiedJobType.UcjtName)
                : query.OrderByDescending(j => j.NotifiedJobType.UcjtName),

            "lp" => isAscending
                ? query.OrderBy(j => j.UcjbLatePick)
                : query.OrderByDescending(j => j.UcjbLatePick),

            "ld" => isAscending
                ? query.OrderBy(j => j.UcjbLateDel)
                : query.OrderByDescending(j => j.UcjbLateDel),

            "time" => isAscending
                ? query.OrderBy(j => j.UcjbDate)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbTime),

            "pod" => isAscending
                ? query.OrderBy(j => j.UcjbPodname)
                : query
                    .OrderByDescending(j => j.UcjbPodname),

            // Default to time
            _ => isAscending
                ? query.OrderBy(j => j.UcjbDate)
                    .ThenBy(j => j.UcjbTime)
                : query
                    .OrderByDescending(j => j.UcjbDate)
                    .ThenByDescending(j => j.UcjbTime),
        };
    }

    private static int? CalculateRemainTime(TucJob job, TucJobType jobType)
    {
        if (job == null)
            return null;

        var now = DateTime.Now;
        var jobDateTime = CombineDateAndTime(job.UcjbDate, job.UcjbTime);

        // Handle Economy Delivery (Speed = 36)
        if (job.UcjbSpeed == 36)
        {
            var economyDeliveryDateTime = CombineDateAndTime(job.UcjbDate, job.DeliverByTime);
            return (int)(economyDeliveryDateTime - now).TotalMinutes;
        }

        // Handle Special Speeds (41,42,43,51,52) with Required Delivery Time
        if (
            job.UcjbSpeed != null
            && SourceArray.Contains(job.UcjbSpeed.Value)
            && job.RequiredDeliveryTime.HasValue
        )
        {
            var requiredDeliveryDateTime = CombineDateAndTime(
                job.UcjbDate,
                job.RequiredDeliveryTime.Value
            );
            return (int)(requiredDeliveryDateTime - now).TotalMinutes;
        }

        // Handle Standard Case
        var standardDeliveryDateTime = jobDateTime.AddMinutes(jobType.Minutes ?? 0);
        return (int)(standardDeliveryDateTime - now).TotalMinutes;
    }

    private static DateTime CombineDateAndTime(DateTime date, DateTime? time)
    {
        if (time is null)
            return date;

        // Else combine the dates
        return new DateTime(
            date.Year,
            date.Month,
            date.Day,
            time.Value.Hour,
            time.Value.Minute,
            time.Value.Second
        );
    }

    public async Task<JobViewModel> GetJobByIdAsync(int jobId)
    {
        try
        {
            // Check for live job first
            var liveJob = await Context.TucJobs
                .Where(j => j.UcjbId == jobId)
                .Select(JobMapping)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (liveJob != null) return liveJob;

            // Check for archived job
            var archivedJob = await Context.TucJobArchives
                .Where(j => j.UcjbId == jobId)
                .Select(JobArchiveMapping)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (archivedJob == null)
            {
                return await Context.TucJobBookings
                    .Where(j => j.UcbkId == jobId)
                    .Select(JobPrebookMapping)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
            }

            // Get charge here
            var totalCharge = await Context.PricingBreakdowns
                .Where(x => x.JobId == jobId)
                .SumAsync(x => x.ChargeAmount);
            archivedJob.Charge = $"${totalCharge:F2}";

            // Get notes here
            var notes = await Context.TucNotes
                .Where(x => x.JobBookingId == jobId)
                .Select(note => new TucNoteViewModel(note))
                .AsNoTracking()
                .ToListAsync();
            archivedJob.Notes = notes;

            return archivedJob;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job {JobId}. Please see exception.", jobId);
            throw;
        }
    }

    public async Task UpdateJobNoteAsync(int jobId, string note)
    {
        try
        {
            Log.Information("Starting note update for job {JobId}", jobId);

            var job = await Context.TucJobs.Where(j => j.UcjbId == jobId).FirstOrDefaultAsync();

            if (job == null)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            Log.Debug(
                "Updating note for job {JobId}. Previous note length: {PreviousLength}",
                jobId,
                job.InternalNotes?.Length ?? 0
            );

            job.UcjbNotes = note;

            await Context.SaveChangesAsync();
            Log.Information(
                "Successfully updated note for job {JobId}. New note length: {NewLength}",
                jobId,
                note?.Length ?? 0
            );
        }
        catch (KeyNotFoundException ex)
        {
            Log.Error(ex, "Job not found when updating note for job {JobId}", jobId);
            throw;
        }
        catch (DbUpdateException ex)
        {
            Log.Error(ex, "Database error occurred while updating note for job {JobId}", jobId);
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error updating note for job {JobId}", jobId);
            throw;
        }
    }

    public async Task UpdateJobConnoteAsync(int jobId, string conNote)
    {
        try
        {
            Log.Information(
                "Starting connote update for job {JobId} with value {Connote}",
                jobId,
                conNote
            );

            // Get both the job and its possible children in one query
            var jobFamily = await Context
                .TucJobs.Where(j => j.UcjbId == jobId || j.ParentId == jobId)
                .ToListAsync();

            var mainJob = jobFamily.FirstOrDefault(j => j.UcjbId == jobId);

            if (mainJob == null)
            {
                Log.Warning("Job {JobId} not found", jobId);
                throw new KeyNotFoundException($"Job with ID {jobId} not found");
            }

            // If this is a child job, get the whole family using parent's ID
            if (mainJob.ParentId.HasValue)
            {
                Log.Information(
                    "Job {JobId} is a child job. Using parent job {ParentId}",
                    jobId,
                    mainJob.ParentId
                );

                jobFamily = await Context
                    .TucJobs.Where(j =>
                        j.UcjbId == mainJob.ParentId || j.ParentId == mainJob.ParentId
                    )
                    .ToListAsync();
            }

            // Update all jobs in the family
            foreach (var job in jobFamily) job.Connote = conNote;

            Log.Information(
                "Updating connote for job family. Parent: {ParentId}, Total Jobs: {TotalJobs}",
                mainJob.ParentId ?? jobId,
                jobFamily.Count
            );

            await Context.SaveChangesAsync();
            Log.Information("Successfully completed connote update for job family {JobId}", jobId);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error updating connote for job {JobId}", jobId);
            throw;
        }
    }

    public async Task<OverviewStatsViewModel> GetOverviewStatsAsync()
    {
        var baseQuery = Context.TucJobs.Where(j => j.InverseParent.Any());

        var stats = await baseQuery
            .GroupBy(j => true) // Group all records together
            .Select(g => new OverviewStatsViewModel
            {
                Active = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Completed = g.Count(j =>
                    j.UcjbStatus.HasValue
                    && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                    && !j.UcjbVoid
                ),
                Inactive = g.Count(j => j.UcjbVoid)
            })
            .FirstOrDefaultAsync();

        return stats
               ?? new OverviewStatsViewModel
               {
                   Active = 0,
                   Inactive = 0,
                   Completed = 0
               };
    }

    public async Task<PaginatedResponse<DeliveryJob>> GetJobsForOverviewPageAsync(
        JobStatusGroup statusGroup,
        int page,
        int limit,
        bool isUsCustomer = true,
        string search = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        string orderBy = "jobName",
        string orderDirection = "asc",
        string regions = null,
        string speeds = null
    )
    {
        // Base query
        var query = Context.TucJobs.Where(j => j.InverseParent.Count != 0);

        // Apply status group
        query = statusGroup switch
        {
            JobStatusGroup.Active => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Completed => query.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Completed.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            ),

            JobStatusGroup.Inactive => query.Where(j => j.UcjbVoid),

            _ => query
        };

        // Apply region filter if provided
        if (!string.IsNullOrWhiteSpace(regions))
        {
            var regionIds = regions.Split(',').Select(int.Parse).ToList();

            query = query.Where(j =>
                j.TblBulkJobs.Any(b => regionIds.Contains(b.Region.BulkRegionId))
            );
        }

        // Apply speed filter if provided
        if (!string.IsNullOrWhiteSpace(speeds))
        {
            var speedIds = speeds.Split(',').Select(int.Parse).ToList();

            query = query.Where(j => speedIds.Contains(j.UcjbSpeedNavigation.UcjtId));
        }

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower().Trim();
            query = query.Where(j =>
                EF.Functions.Like(j.UcjbNumber.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.UcjbStatusNavigation.UcjsName.ToLower(), $"%{search}%")
                || j.TblBulkJobs.Any(b => EF.Functions.Like(b.Region.Name.ToLower(), $"%{search}%"))
                || EF.Functions.Like(j.PickupAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.PickupAddressLine6.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine5.ToLower(), $"%{search}%")
                || EF.Functions.Like(j.DeliveryAddressLine6.ToLower(), $"%{search}%")
                || (
                    j.UcjbCourier != null
                    && (
                        EF.Functions.Like(j.UcjbCourier.UccrName.ToLower(), $"%{search}%")
                        || EF.Functions.Like(j.UcjbCourier.UccrSurname.ToLower(), $"%{search}%")
                    )
                )
            );
        }

        // Apply date range filter
        if (startDate.HasValue)
            query = query.Where(j => j.UcjbDate >= startDate);
        if (endDate.HasValue)
            query = query.Where(j => j.UcjbDate <= endDate);

        // Apply sorting
        query = ApplySorting(query, orderBy, orderDirection);

        // Get total count for pagination
        var total = await query.CountAsync();
        var pages = (int)Math.Ceiling(total / (double)limit);

        // Apply pagination
        var jobs = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(j => new DeliveryJob
            {
                JobId = j.UcjbId,
                JobName = j.UcjbNumber,
                Status = j.UcjbStatusNavigation.UcjsName,
                Region =
                    j.TblBulkJobs.FirstOrDefault() != null
                        ? j.TblBulkJobs.FirstOrDefault().Region.Name
                        : null,
                Pickup = isUsCustomer
                    ? j.PickupAddressLine5 + ", " + j.PickupAddressLine6
                    : j.UcjbFromAddr,
                Delivery = isUsCustomer
                    ? j.DeliveryAddressLine5 + ", " + j.DeliveryAddressLine6
                    : j.UcjbToAddr,
                Driver =
                    j.UcjbCourier != null
                        ? j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
                        : null,
                Completion = j.InverseParent.Any()
                    ? (int)
                    Math.Round(
                        (double)
                        j.InverseParent.Count(c =>
                            c.UcjbJobDone
                            || (
                                c.UcjbStatus.HasValue
                                && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                            )
                        )
                        / j.InverseParent.Count
                        * 100
                    )
                    : 0,
                ChildJobs = j
                    .InverseParent.Select(c => new ChildDeliveryJob
                    {
                        JobId = c.UcjbId,
                        JobName = c.UcjbNumber,
                        Status = c.UcjbStatusNavigation.UcjsName,
                        Region =
                            c.TblBulkJobs.FirstOrDefault() != null
                                ? c.TblBulkJobs.FirstOrDefault().Region.Name
                                : null,
                        Pickup = c.PickupAddressLine5 + ", " + c.PickupAddressLine6,
                        Delivery = c.DeliveryAddressLine5 + ", " + c.DeliveryAddressLine6,
                        Driver =
                            c.UcjbCourier != null
                                ? c.UcjbCourier.UccrName + " " + c.UcjbCourier.UccrSurname
                                : null,
                        Completion =
                            c.UcjbJobDone || c.UcjbStatus == (int)JobStatus.Completed ? 100 : 0
                    })
                    .ToList()
            })
            .AsNoTracking()
            .ToListAsync();

        return new PaginatedResponse<DeliveryJob>
        {
            Items = jobs,
            Total = total,
            Page = page,
            Pages = pages
        };
    }

    private static IQueryable<TucJob> ApplySorting(
        IQueryable<TucJob> query,
        string orderBy,
        string orderDirection
    )
    {
        var isAscending = !orderDirection.Equals("desc", StringComparison.CurrentCultureIgnoreCase);

        query = orderBy?.ToLower() switch
        {
            "jobname" => isAscending
                ? query.OrderBy(j => j.UcjbNumber)
                : query.OrderByDescending(j => j.UcjbNumber),

            "status" => isAscending
                ? query.OrderBy(j => j.UcjbStatusNavigation.UcjsName)
                : query.OrderByDescending(j => j.UcjbStatusNavigation.UcjsName),

            "completion" => isAscending
                ? query.OrderBy(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                )
                : query.OrderByDescending(j =>
                    j.InverseParent.Count(c =>
                        c.UcjbJobDone
                        || (
                            c.UcjbStatus.HasValue
                            && JobStatusGroups.Completed.Contains(c.UcjbStatus.Value)
                        )
                    )
                    / (double)j.InverseParent.Count
                    * 100
                ),

            "pickup" => isAscending
                ? query.OrderBy(j => j.PickupAddressLine5)
                : query.OrderByDescending(j => j.PickupAddressLine5),

            "delivery" => isAscending
                ? query.OrderBy(j => j.DeliveryAddressLine5)
                : query.OrderByDescending(j => j.DeliveryAddressLine5),

            "driver" => isAscending
                ? query.OrderBy(j => j.UcjbCourier.UccrName)
                : query.OrderByDescending(j => j.UcjbCourier.UccrName),

            "region" => isAscending
                ? query.OrderBy(j => j.TblBulkJobs.FirstOrDefault().Region.Name)
                : query.OrderByDescending(j => j.TblBulkJobs.FirstOrDefault().Region.Name),

            _ => query.OrderBy(j => j.UcjbNumber) // Default sort
        };

        return query;
    }

    public async Task<OverviewDeliveryMapResponse> GetOverviewLocationDataAsync(int jobId)
    {
        var locations = await Context
            .TucJobs.Where(j => j.UcjbId == jobId)
            .Select(j => new OverviewDeliveryMapResponse
            {
                Center = new Coordinates { Lat = (decimal)39.8097343, Lng = (decimal)-98.5556199 },
                Zoom = 5,
                SelectedJobIndex = 0,
                Job = new OverviewJobLocation
                {
                    Id = j.UcjbId,
                    Pickup = new Coordinates
                    {
                        Lat = j.PickUpLatitude ?? 0,
                        Lng = j.PickUpLongitude ?? 0
                    },
                    Delivery = new Coordinates
                    {
                        Lat = j.DeliveryLatitude ?? 0,
                        Lng = j.DeliveryLongitude ?? 0
                    },
                    ChildJobs = j
                        .InverseParent.Select(c => new OverviewChildJobLocation
                        {
                            Id = c.UcjbId,
                            Pickup = new Coordinates
                            {
                                Lat = c.PickUpLatitude ?? 0,
                                Lng = c.PickUpLongitude ?? 0
                            },
                            Delivery = new Coordinates
                            {
                                Lat = c.DeliveryLatitude ?? 0,
                                Lng = c.DeliveryLongitude ?? 0
                            },
                            Flight =
                                j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                                || IsFlightJobNumber(j.UcjbNumber)
                        })
                        .ToList()
                }
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return locations;
    }

    public async Task<decimal> RateJobAsync(
        int clientId,
        int fromId,
        int toId,
        int speed,
        bool pedal,
        bool van,
        bool returnJob,
        int weight,
        int size,
        bool includeFuelSurcharge,
        bool direct,
        int acceptedJobTypeId,
        string ourRef,
        string refA,
        string refB,
        int quantity,
        DateTime booked
    )
    {
        var curAmount = new OutputParameter<decimal?>();

        await Context.Procedures.sp_RateJob2Async(
            clientId,
            fromId,
            toId,
            speed,
            pedal,
            van,
            returnJob,
            weight,
            size,
            includeFuelSurcharge,
            ourRef,
            refA,
            refB,
            quantity,
            booked,
            curAmount
        );

        return curAmount.Value ?? 0;
    }

    public async Task<decimal> RateJobUsAsync(
        int jobId,
        int clientId,
        int speed,
        string fromZip,
        string toZip,
        decimal totalMiles,
        decimal fromMiles,
        decimal toMiles,
        int weight,
        DateTime booked,
        int size,
        bool dangerousGoods,
        int totalPallets,
        int extraStopOffs,
        int dryIceWeight,
        int waitTime,
        int? fromAgentId,
        int? fromAirportId,
        int? toAgentId,
        int? toAirportId
    )
    {
        var rate = new OutputParameter<decimal?>();
        var description = new OutputParameter<string>();
        var returnValue = new OutputParameter<int>();

        await Context.Procedures.DD_stpJob_Rate_DescribedAsync(
            clientId,
            speed,
            string.IsNullOrEmpty(fromZip) ? null : int.Parse(fromZip),
            null, // Added missing parameter
            string.IsNullOrEmpty(toZip) ? null : int.Parse(toZip),
            null, // Added missing parameter
            totalMiles,
            fromMiles,
            toMiles,
            weight,
            null, // Added missing parameter
            null, // Added missing parameter
            totalPallets,
            extraStopOffs,
            booked,
            size,
            dangerousGoods,
            dryIceWeight,
            waitTime,
            fromAgentId,
            fromAirportId,
            toAgentId,
            toAirportId,
            description,
            rate,
            returnValue // Added missing parameter
        );

        await Context.Procedures.DD_InsertPricingBreakdownAsync(
            jobId,
            null,
            description.Value,
            returnValue // Added missing parameter
        );

        return rate.Value ?? 0;
    }

    public async Task<TucJobType> GetJobTypeById(int speedId)
    {
        var jobType = await Context
            .TucJobTypes.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UcjtId == speedId);

        if (jobType == null)
            throw new KeyNotFoundException($"Job type with ID {speedId} not found");

        return jobType;
    }

    public async Task<TucJobTypeGrouping> GetJobTypeGrouping(int groupingId)
    {
        var grouping = await Context
            .TucJobTypeGroupings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GroupingId == groupingId);

        if (grouping == null)
            throw new KeyNotFoundException($"Job type grouping with ID {groupingId} not found");

        return grouping;
    }

    public async Task<List<AddressWithAgent>> GetClosestAirports(
        decimal latitude,
        decimal longitude
    )
    {
        try
        {
            var latRad = (double)latitude / 57.3;

            var closestAirports = await Context
                .TblAirports.Where(a => a.Active)
                .Select(a => new AddressWithAgent
                {
                    AirportId = a.AirportId,
                    AirportCode = a.AirportCode,
                    StreetAddress = a.StreetAddress,
                    City = a.Name,
                    AgentId = a.AgentId ?? 0,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    Distance = (decimal)
                        Math.Sqrt(
                            Math.Pow(110.574 * ((double)latitude - (double)a.Latitude), 2)
                            + Math.Pow(
                                110.574
                                * ((double)a.Longitude - (double)longitude)
                                * Math.Cos(latRad),
                                2
                            )
                        )
                })
                .OrderBy(a => a.Distance)
                .Take(3)
                .AsNoTracking()
                .ToListAsync();

            return closestAirports;
        }
        catch (Exception ex)
        {
            throw new ApplicationException("Error while fetching closest airports", ex);
        }
    }

    public async Task<List<MegaMapResponse>> GetJobsForMegaMapAsync()
    {
        // Get active jobs to display on map
        var jobs = await Context
            .TucJobs.Where(j =>
                j.UcjbStatus.HasValue
                && JobStatusGroups.Active.Contains(j.UcjbStatus.Value)
                && !j.UcjbVoid
            )
            .Select(j => new MegaMapResponse
            {
                JobId = j.UcjbId,
                JobNumber = j.UcjbNumber,
                JobStatus = j.UcjbStatus != null ? j.UcjbStatusNavigation.UcjsName : "New",
                EstimatedDelivery =
                    (
                        j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                        || IsFlightJobNumber(j.UcjbNumber)
                    )
                    && j.TucJobNationwides.Count != 0
                        ? j.TucJobNationwides.FirstOrDefault().UcnwEta.Value
                        : j
                            .UcjbDate.Date.Add(j.UcjbTime.Value.TimeOfDay)
                            .AddMinutes(j.UcjbSpeedNavigation.Minutes ?? 180),
                IsFlightJob =
                    j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                    || IsFlightJobNumber(j.UcjbNumber),
                PickupLocation = new AddressViewModel
                {
                    Latitude = j.PickUpLatitude ?? 0,
                    Longitude = j.PickUpLongitude ?? 0,
                    AddressLine1 = j.PickupAddressLine1,
                    AddressLine2 = j.PickupAddressLine2,
                    AddressLine3 = j.PickupAddressLine3,
                    AddressLine4 = j.PickupAddressLine4,
                    AddressLine5 = j.PickupAddressLine5,
                    AddressLine6 = j.PickupAddressLine6,
                    AddressLine7 = j.PickupAddressLine7,
                    AddressLine8 = j.PickupAddressLine8
                },
                DeliveryLocation = new AddressViewModel
                {
                    Latitude = j.DeliveryLatitude ?? 0,
                    Longitude = j.DeliveryLongitude ?? 0,
                    AddressLine1 = j.DeliveryAddressLine1,
                    AddressLine2 = j.DeliveryAddressLine2,
                    AddressLine3 = j.DeliveryAddressLine3,
                    AddressLine4 = j.DeliveryAddressLine4,
                    AddressLine5 = j.DeliveryAddressLine5,
                    AddressLine6 = j.DeliveryAddressLine6,
                    AddressLine7 = j.DeliveryAddressLine7,
                    AddressLine8 = j.DeliveryAddressLine8
                },
                CourierLocation = j.UcjbCourierId.HasValue
                    ? new CourierLocation
                    {
                        CourierId = j.UcjbCourier.UccrId,
                        CourierName =
                            $"{j.UcjbCourier.UccrName} {j.UcjbCourier.UccrSurname}".Trim(),
                        Coordinates = j.UcjbCourier.CourierGpsid.HasValue
                            ? new Coordinates
                            {
                                Lat = (decimal)j.UcjbCourier.CourierGps.Latitude,
                                Lng = (decimal)j.UcjbCourier.CourierGps.Longitude
                            }
                            : null
                    }
                    : null,
                FlightInfo =
                    j.UcjbSpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                    || IsFlightJobNumber(j.UcjbNumber)
                        ? j
                            .TucJobNationwides.Select(n => new AssignedFlight
                            {
                                FlightNumber = n.UcnwFlightNo,
                                ExpectedArrival = n.UcnwEta,
                                ExpectedDeparture = n.UcnwEtd
                            })
                            .FirstOrDefault()
                        : null
            })
            .AsNoTracking()
            .ToListAsync();

        return jobs;
    }

    private static bool IsFlightJobNumber(string input) =>
        !string.IsNullOrEmpty(input) && input.EndsWith("2");

    public async Task UpdatePackagesForJobAsync(int jobId, List<ParcelDimensions> parcels)
    {
        try
        {
            // Map and split parcels into new and existing items
            var mappedParcels = parcels
                .Select(p => new TucJobItem
                {
                    ItemId = p.ItemId ?? 0,
                    JobId = jobId,
                    Height = p.Height ?? 0,
                    Length = p.Length ?? 0,
                    Depth = p.Depth ?? 0,
                    Notes = p.ItemName
                })
                .ToList();

            var newParcels = mappedParcels.Where(p => p.ItemId == 0).ToList();
            var existingParcels = mappedParcels.Where(p => p.ItemId != 0).ToList();

            // Handle new items
            if (newParcels.Count != 0)
                await Context.TucJobItems.AddRangeAsync(newParcels);

            // Handle existing items
            foreach (var parcel in existingParcels)
            {
                var existingItem = await Context.TucJobItems.FirstOrDefaultAsync(i =>
                    i.ItemId == parcel.ItemId
                );

                if (existingItem == null)
                    continue;
                existingItem.Height = parcel.Height;
                existingItem.Length = parcel.Length;
                existingItem.Depth = parcel.Depth;
                existingItem.Notes = parcel.Notes;
                Context.TucJobItems.Update(existingItem);
            }

            await Context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            throw new ApplicationException("Error while updating packages for job", e);
        }
    }

    public async Task<List<T>> GetAllAsync<T>()
        where T : class
    {
        try
        {
            return await Context.Set<T>().ToListAsync();
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Error retrieving all {typeof(T).Name} records");
            throw;
        }
    }

    public async Task<List<JobCoordinateModel>> GetJobCoordinatesAsync(
        bool isInternal,
        bool isUsTenant,
        string clientIds,
        List<int> selectedViewIds)
    {
        try
        {
            var query = await BuildBaseQuery(selectedViewIds);
            if (query == null) return [];

            query = query.Where(j => j.UcjbStatus != 9);

            var jobCoordinates = await query
                .Select(j => new JobCoordinateModel
                {
                    Id = j.UcjbId,
                    JobNo = j.UcjbNumber,
                    PickupLatitude = j.PickUpLatitude,
                    PickupLongitude = j.PickUpLongitude,
                    DeliveryLatitude = j.DeliveryLatitude,
                    DeliveryLongitude = j.DeliveryLongitude,
                    StatusId = j.UcjbStatus,
                    StatusName = j.UcjbStatusNavigation.UcjsName,
                    ClientId = j.UcjbClientId ?? 0,
                    ClientName = j.UcjbClient.UcclName,
                    Speed = j.UcjbSpeedNavigation.ShortName,
                    FromAddress = j.UcjbFromAddr,
                    ToAddress = j.UcjbToAddr
                })
                .AsNoTracking()
                .ToListAsync();

            return jobCoordinates;
        }
        catch (Exception e)
        {
            Log.Error(e, "Error occurred getting job coordinates. Please see exception.");
            throw;
        }
    }

    public async Task<List<TucNoteViewModel>> GetNotesByJobId(int jobId)
    {
        ArgumentNullException.ThrowIfNull(jobId);

        return await IsJobArchived(jobId)
            ? await GetArchivedNotesByJobIdAsync(jobId)
            : await GetActiveNotesByJobIdAsync(jobId);
    }

    public async Task<TucNoteViewModel> GetNoteByIdAsync(int noteId)
    {
        ArgumentNullException.ThrowIfNull(noteId);

        var note = await Context.TucNotes
            .Include(x => x.NoteType)
            .Include(x => x.CreatedByNavigation)
            .Include(x => x.UpdatedByNavigation)
            .AsNoTracking()
            .Where(x => x.NoteId == noteId)
            .Select(x => new TucNoteViewModel(x))
            .FirstOrDefaultAsync();

        return note ?? await GetArchivedNoteByIdAsync(noteId);
    }

    public async Task<int> SaveNoteAsync(TucNoteViewModel viewModel, int staffId)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        ArgumentNullException.ThrowIfNull(staffId);

        return viewModel.NoteId == 0
            ? await CreateNoteAsync(viewModel, staffId)
            : await UpdateNoteAsync(viewModel, staffId);
    }

    public async Task<int> SaveNoteAsync(int jobId, string noteText, string despatcherName, bool isImportant = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText, nameof(noteText));
        ArgumentException.ThrowIfNullOrWhiteSpace(despatcherName, nameof(despatcherName));

        var staffId = await Context.TucStaffs
            .Where(s => s.UcstFirstName + " " + s.UcstLastName == despatcherName)
            .Select(s => s.UcstId)
            .FirstOrDefaultAsync();

        ArgumentNullException.ThrowIfNull(staffId);

        return await CreateBasicNoteAsync(jobId, noteText, staffId, isImportant);
    }

    public async Task<int> SaveNoteAsync(int jobId, string noteText, int staffId, bool isImportant = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(noteText, nameof(noteText));
        return await CreateBasicNoteAsync(jobId, noteText, staffId, isImportant);
    }

    public async Task DeleteNoteAsync(int noteId)
    {
        var note = await Context.TucNotes.FindAsync(noteId);
        if (note != null)
        {
            Context.TucNotes.Remove(note);
            await Context.SaveChangesAsync();
        }
    }

    private async Task<bool> IsJobArchived(int jobId) =>
        await Context.TucJobArchives.AnyAsync(j => j.UcjbId == jobId);

    private async Task<List<TucNoteViewModel>> GetActiveNotesByJobIdAsync(int jobId) =>
        await Context.TucNotes
            .Include(x => x.NoteType)
            .Include(x => x.CreatedByNavigation)
            .Include(x => x.UpdatedByNavigation)
            .Where(x => x.JobId == jobId || x.JobBookingId == jobId)
            .AsNoTracking()
            .Select(x => new TucNoteViewModel(x))
            .ToListAsync();

   private async Task<List<TucNoteViewModel>> GetArchivedNotesByJobIdAsync(int jobId)
{
var query = from note in Context.TucNoteArchives
    join noteType in Context.TucNoteTypes
        on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
    from nt in noteTypes.DefaultIfEmpty()
    join createdBy in Context.TucStaffs
        on note.CreatedBy equals createdBy.UcstId into createdStaff
    from cs in createdStaff.DefaultIfEmpty()
    join updatedBy in Context.TucStaffs
        on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
    from us in updatedStaff.DefaultIfEmpty()
    join job in Context.TucJobArchives
        on note.JobId equals job.UcjbId into jobs
    from j in jobs.DefaultIfEmpty()
    where note.JobId == jobId || note.JobBookingId == jobId
    select new TucNoteViewModel
    {
        // Note properties
        NoteId = note.NoteId,
        NoteText = note.NoteText,
        CreatedDate = note.CreatedDate ?? j.UcjbComplTime ?? DateTime.MinValue,
        UpdatedDate = note.UpdatedDate,
        JobId = note.JobId,
        JobBookingId = note.JobBookingId,

        // Related entity properties
        NoteTypeId = note.NoteTypeId,
        NoteTypeName = nt.NoteTypeName,

        // Staff information
        CreatedBy = note.CreatedBy,
        CreatedByName = cs != null ? cs.UcstFirstName + " " + cs.UcstLastName : null,
        UpdatedBy = note.UpdatedBy,
        UpdatedByName = us != null ? us.UcstFirstName + " " + us.UcstLastName : null,

        // Job information
        JobNumber = j != null ? j.UcjbNumber : null
    };

    var archivedNotes = await query.ToListAsync();
    return archivedNotes;
}

private async Task<TucNoteViewModel> GetArchivedNoteByIdAsync(int noteId)
{
    var query = from note in Context.TucNoteArchives
        join noteType in Context.TucNoteTypes
            on note.NoteTypeId equals noteType.NoteTypeId into noteTypes
        from nt in noteTypes.DefaultIfEmpty()
        join createdBy in Context.TucStaffs
            on note.CreatedBy equals createdBy.UcstId into createdStaff
        from cs in createdStaff.DefaultIfEmpty()
        join updatedBy in Context.TucStaffs
            on note.UpdatedBy equals updatedBy.UcstId into updatedStaff
        from us in updatedStaff.DefaultIfEmpty()
        join job in Context.TucJobArchives
            on note.JobId equals job.UcjbId into jobs
        from j in jobs.DefaultIfEmpty()
        where note.NoteId == noteId
           select new TucNoteViewModel
            {
                // Note properties
                NoteId = note.NoteId,
                NoteText = note.NoteText,
                CreatedDate = note.CreatedDate ?? j.UcjbComplTime ?? DateTime.MinValue,
                UpdatedDate = note.UpdatedDate,
                JobId = note.JobId,
                JobBookingId = note.JobBookingId,

                // Related entity properties
                NoteTypeId = note.NoteTypeId,
                NoteTypeName =nt.NoteTypeName,

                // Staff information
                CreatedBy = note.CreatedBy,
                CreatedByName = cs != null ? cs.UcstFirstName + " " + cs.UcstLastName : null,
                UpdatedBy = note.UpdatedBy,
                UpdatedByName = us != null ? us.UcstFirstName + " " + us.UcstLastName : null,

                // Job information
                JobNumber = j != null ? j.UcjbNumber : null
            };

            var archivedNote = await query.FirstOrDefaultAsync();
            return archivedNote;
}

    private async Task<int> CreateNoteAsync(TucNoteViewModel viewModel, int staffId)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        ArgumentNullException.ThrowIfNull(viewModel.JobId);

        var currentTime = timeService.GetCurrentTenantTime();
        int noteId;

        if (await IsJobArchived(viewModel.JobId.Value))
            noteId = await CreateArchivedNoteAsync(viewModel, staffId, currentTime);
        else
            noteId = await CreateActiveNoteAsync(viewModel, staffId, currentTime);

        await UpdateJobNotesIfPublicAsync(viewModel.NoteTypeId, viewModel.JobId.Value, viewModel.NoteText);
        return noteId;
    }

    private async Task<int> CreateArchivedNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime)
    {
        var archivedNote = viewModel.ToArchivedEntity();
        archivedNote.CreatedDate = currentTime;
        archivedNote.CreatedBy = staffId;

        await Context.TucNoteArchives.AddAsync(archivedNote);
        await Context.SaveChangesAsync();
        return archivedNote.NoteId;
    }

    private async Task<int> CreateActiveNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime)
    {
        var activeNote = viewModel.ToEntity();
        activeNote.CreatedDate = currentTime;
        activeNote.CreatedBy = staffId;

        await Context.TucNotes.AddAsync(activeNote);
        await Context.SaveChangesAsync();
        return activeNote.NoteId;
    }

    private async Task<int> UpdateNoteAsync(TucNoteViewModel viewModel, int staffId)
    {
        ArgumentNullException.ThrowIfNull(viewModel);
        ArgumentNullException.ThrowIfNull(viewModel.JobId);

        var currentTime = timeService.GetCurrentTenantTime();
        int noteId;

        if (await IsJobArchived(viewModel.JobId.Value))
            noteId = await UpdateArchivedNoteAsync(viewModel, staffId, currentTime);
        else
            noteId = await UpdateActiveNoteAsync(viewModel, staffId, currentTime);

        if (viewModel.JobId.HasValue)
            await UpdateJobNotesIfPublicAsync(viewModel.NoteTypeId, viewModel.JobId.Value, viewModel.NoteText);

        return noteId;
    }

    private async Task<int> UpdateArchivedNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime)
    {
        var archivedNote = await Context.TucNoteArchives.FindAsync(viewModel.NoteId);
        ArgumentNullException.ThrowIfNull(archivedNote);

        UpdateNoteProperties(archivedNote, viewModel);
        archivedNote.UpdatedDate = currentTime;
        archivedNote.UpdatedBy = staffId;

        Context.TucNoteArchives.Update(archivedNote);
        await Context.SaveChangesAsync();

        return archivedNote.NoteId;
    }

    private async Task<int> UpdateActiveNoteAsync(TucNoteViewModel viewModel, int staffId, DateTime currentTime)
    {
        var activeNote = await Context.TucNotes.FindAsync(viewModel.NoteId);
        ArgumentNullException.ThrowIfNull(activeNote);

        UpdateNoteProperties(activeNote, viewModel);
        activeNote.UpdatedDate = currentTime;
        activeNote.UpdatedBy = staffId;

        Context.TucNotes.Update(activeNote);
        await Context.SaveChangesAsync();

        return activeNote.NoteId;
    }

    private static void UpdateNoteProperties<T>(T note, TucNoteViewModel viewModel)
        where T : class
    {
        dynamic dynamicNote = note;
        dynamicNote.NoteTypeId = viewModel.NoteTypeId;
        dynamicNote.JobId = viewModel.JobId;
        dynamicNote.JobBookingId = viewModel.JobBookingId;
        dynamicNote.NoteText = viewModel.NoteText;
        dynamicNote.IsImportant = viewModel.IsImportant;
    }

    private async Task<int> CreateBasicNoteAsync(
        int jobId,
        string noteText,
        int staffId,
        bool isImportant,
        CancellationToken cancellationToken = default)
    {
        var currentTime = timeService.GetCurrentTenantTime();
        const int internalNoteTypeId = (int)NoteType.InternalNote;
        int noteId;

        if (await IsJobArchived(jobId))
        {
            var archivedNote = new TucNoteArchive
            {
                JobId = jobId,
                NoteTypeId = internalNoteTypeId,
                NoteText = noteText,
                IsImportant = isImportant,
                CreatedDate = currentTime,
                CreatedBy = staffId
            };

            await Context.TucNoteArchives.AddAsync(archivedNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);
            noteId = archivedNote.NoteId;
        }
        else
        {
            var activeNote = new TucNote
            {
                JobId = jobId,
                NoteTypeId = internalNoteTypeId,
                NoteText = noteText,
                IsImportant = isImportant,
                CreatedDate = currentTime,
                CreatedBy = staffId
            };

            await Context.TucNotes.AddAsync(activeNote, cancellationToken);
            await Context.SaveChangesAsync(cancellationToken);
            noteId = activeNote.NoteId;
        }

        await UpdateJobNotesIfPublicAsync(internalNoteTypeId, jobId, noteText, cancellationToken);
        return noteId;
    }

    private async Task UpdateJobNotesIfPublicAsync(
        int noteTypeId,
        int jobId,
        string noteText,
        CancellationToken cancellationToken = default)
    {
        var noteType = await Context.TucNoteTypes
            .FirstOrDefaultAsync(nt => nt.NoteTypeId == noteTypeId, cancellationToken);

        if (noteType?.IsPublic == false) return;

        await UpdateJobNotesAsync(jobId, noteText, cancellationToken);
    }

    private async Task UpdateJobNotesAsync(
        int jobId,
        string noteText,
        CancellationToken cancellationToken = default)
    {
        const string noteSeparator = "\n ";
        var job = await Context.TucJobs.FindAsync([jobId], cancellationToken);

        if (job != null)
        {
            job.UcjbNotes = job.UcjbNotes + noteSeparator + noteText;
            Context.TucJobs.Update(job);
            await Context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<List<Suggestion>> GetNoteTypesAsync()
    {
        var noteTypes = await Context.TucNoteTypes
            .Where(x => x.IsActive)
            .Select(x => new Suggestion
            {
                Id = x.NoteTypeId,
                Text = x.NoteTypeName
            })
            .AsNoTracking()
            .ToListAsync();

        return noteTypes;
    }
}
