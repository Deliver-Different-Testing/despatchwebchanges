using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
    public static readonly Expression<Func<TucJob, JobLateCallDto>> JobLateCallMapping =
        j => new JobLateCallDto
        {
            Id = j.UcjbId,
            ClientId = j.UcjbClientId ?? 0,
            PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime ?? 0 : 0,
            DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime ?? 0 : 0,
            AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : 0,
            AlertLateDelivery = j.UcjbClient != null ? j.UcjbClient.AlertLateDelivery : 0,
            JobTime = j.UcjbDate.CombineWithTime(j.UcjbTime),
            BookedSpeed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : string.Empty,
            NotifiedSpeed = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName
                : j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName
                : string.Empty
        };

    public static Expression<Func<TucJob, JobViewModel>> JobMappingCore(bool isUsCustomer) => j => new JobViewModel
    {
        AngularId = Guid.NewGuid(),
        ClientId = j.UcjbClientId,
        Id = j.UcjbId,
        JobNo = j.UcjbNumber,
        Time = j.UcjbTime,
        ParentId = j.ParentId,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.UcjbDate),
        Booked = j.UcjbDate.CombineWithTime(j.UcjbTime),
        // UcjbDispTime is a datetime that legacy create-flows pre-fill with the
        // booking's time-of-day under a 1900-01-01 sentinel date - rendering it
        // directly produces "Jan/01 23:00" on undispatched jobs. The actual
        // dispatch moment lives split across UcjbDispDate (date) + UcjbDispTime
        // (time portion), both stamped together at dispatch (JobRepository:5340,
        // NationwideJobRepository:155). Combine them when DispDate carries a
        // real value; surface NULL otherwise so the UI shows '-'.
        DispatchTime = j.UcjbDispDate.HasValue && j.UcjbDispDate.Value.Year > 1900
            ? j.UcjbDispDate.Value.CombineWithTime(j.UcjbDispTime)
            : null,
        CreatedDate = j.CreatedTimeUtc,
        ScheduleName = j.ScheduleName ?? Defaults.NotAvailable,
        FollowupTime = j.FollowupTime,
        Void = j.UcjbVoid,
        IsInvoiced = false,
        Barcode = j.Barcode ?? Defaults.NotAvailable,
        AllowSplit = !j.ParentId.HasValue || j.ParentId == j.UcjbId,

        // Flight card
        IsFlightJob = j.UcjbSpeedNavigation != null
                      && j.UcjbSpeedNavigation.GroupingId ==
                      (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
        IsAgentJob = j.UcjbSpeedNavigation != null
                     && j.UcjbSpeedNavigation.GroupingId !=
                     (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),

        // Simple navigation properties
        LoggedInContactName = j.LoggedInContact != null
            ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
            : string.Empty,
        BookingSource = j.Source != null
            ? new Suggestion { Id = j.Source.SourceId, Text = j.Source.Name }
            : null,

        PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
        DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

        // Courier - Simple navigation
        Courier = j.UcjbCourierId != null ? j.UcjbCourier.Code : null,
        CourierData = j.UcjbCourierId != null
            ? new CourierData
            {
                Courier = j.UcjbCourier.Code,
                CourierNumber = j.UcjbCourier.Code,
                CourierId = j.UcjbCourierId,
                CourierMobile = j.UcjbCourier.UccrMobile,
                CourierName = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
            }
            : null,
        AssignedCourier = j.UcjbCourier != null
            ? new Suggestion
            {
                Id = j.UcjbCourier.UccrId,
                Text = j.UcjbCourier.UccrName + " " + j.UcjbCourier.UccrSurname
            }
            : null,

        // Address information - Direct properties (no navigation)
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

        // Airport IDs (load flight info separately)
        ToAirportId = j.ToAirportId,
        FromAirportId = j.FromAirportId,

        // Agent
        AssignedAgent = j.Agent != null
            ? new AgentViewModel
            {
                AgentId = j.Agent.UcagId,
                AgentName = j.Agent.UcagName ?? Defaults.NotAvailable,
                AgentRanking = j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : Defaults.NotAvailable,
                AgentEmail = j.Agent.UcagFax ?? Defaults.NotAvailable,
                AgentPhone = j.Agent.UcagPhone ?? Defaults.NotAvailable
            }
            : null,
        IsAgentAssigned = j.Agent != null,

        // Tracking info
        TrackingMethod = j.TrackingMethod,
        TrackingMobile = j.TrackingMobile,
        TrackingEmail = j.TrackingEmail ?? Defaults.NotAvailable,

        // Delivery details
        PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
        Return = j.UcjbReturn,
        SaturdayDelivery = j.SaturdayDelivery,
        CompletedTime = j.UcjbComplTime,
        UdStatus = j.UndeliverableLocation != null ? j.UndeliverableLocation.Name : string.Empty,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact ?? Defaults.NotSpecified,
        DispatcherName = j.UcjbDisp != null ? FormatFullName(j.UcjbDisp) : null,

        // Location data
        PickUpLatitude = j.PickUpLatitude,
        PickUpLongitude = j.PickUpLongitude,
        DeliveryLatitude = j.DeliveryLatitude,
        DeliveryLongitude = j.DeliveryLongitude,

        // Client information
        Client = j.UcjbClientCode,
        ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone ?? Defaults.NotSpecified,
        PodName = j.UcjbPodname,
        PuTime = j.PickUpTime,

        // Job characteristics
        Weight = j.UcjbWeight,
        CalculateDimsOncePerJob = j.DimensionsType == 2,
        ToAddress = j.UcjbToAddr,
        JobType = (int)(j.UcjbType ?? 0),
        JobTypeDescription = GetJobTypeDescription(j.UcjbType ?? 0),
        Direct = j.Direct,
        Van = j.UcjbVan,
        VanOk = j.VanOk,
        Truck = j.Truck,
        DgClass = j.Dgclass,
        DgDocumentation = j.Dgdocument,
        HasDgDocsString = j.Dgdocument != null ? "Yes" : "No",

        // Job status and details
        Done = j.UcjbJobDone,
        AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : null,
        AlertLateDelivery = j.UcjbClient != null ? j.UcjbClient.AlertLateDelivery : null,
        Lp = j.UcjbLatePick,
        Ld = j.UcjbLateDel,
        Items = j.TucJobItemChildJobs.Any()
            ? j.TucJobItemChildJobs.Count
            : j.TucJobItemJobs.Count > 0
                ? j.TucJobItemJobs.Count
                : j.Parent != null
                    ? j.Parent.TucJobItemJobs.Count(i => i.ChildJobId == null)
                    : 0,

        PickupFrom = j.UcjbPickUpFrom,
        Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
        FromContactName = j.PickupFromContact,
        BookingContactEmail = j.Contact != null ? j.Contact.UcctEmail : null,
        FromContactNumber =
            j.PickupFromPhone != null && j.PickupFromPhone != string.Empty
                ? j.PickupFromPhone
                : j.Contact != null && j.Contact.UcctDirectDial != null && j.Contact.UcctDirectDial != string.Empty
                    ? j.Contact.UcctDirectDial
                    : j.Contact != null && j.Contact.UcctMobile != null && j.Contact.UcctMobile != string.Empty
                        ? j.Contact.UcctMobile
                        : j.UcjbClient != null && j.UcjbClient.UcclPhone != null && j.UcjbClient.UcclPhone != string.Empty
                            ? j.UcjbClient.UcclPhone
                            : null,
        FromContactNumberSource =
            j.PickupFromPhone != null && j.PickupFromPhone != string.Empty
                ? "Job"
                : j.Contact != null && j.Contact.UcctDirectDial != null && j.Contact.UcctDirectDial != string.Empty
                    ? "Direct Line"
                    : j.Contact != null && j.Contact.UcctMobile != null && j.Contact.UcctMobile != string.Empty
                        ? "Mobile"
                        : j.UcjbClient != null && j.UcjbClient.UcclPhone != null && j.UcjbClient.UcclPhone != string.Empty
                            ? "Company"
                            : null,

        // Speed and job type information
        Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
        SpeedName = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.UcjtName : null,
        NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
        AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
        SpeedId = j.UcjbSpeed,
        NotifiedJobTypeId = j.NotifiedJobTypeId,
        AcceptedJobTypeId = j.AcceptedJobTypeId,

        // References
        RefA = j.UcjbClientRefa,
        RefB = j.UcjbClientRefb,
        OurRef = j.UcjbOurRef,

        // Charge - use amount that we will charge to the client
        Charge = j.UcjbAmount,

        // Status
        StatusId = j.UcjbStatus,
        Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
        StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
        InternalStatusId = j.InternalStatus,
        ConNote = j.Parent != null ? j.Parent.Connote : j.Connote,

        // Checkboxes
        Reprice = j.Reprice,

        // Size
        Size = j.UcjbSizeNavigation != null
            ? new Suggestion
            {
                Id = j.UcjbSizeNavigation.VehicleSizeId,
                Text = j.UcjbSizeNavigation.VehicleName
            }
            : null,

        IsArchived = false,
        PreBook = false,
        DeliverByTime = j.DeliverByTime,
        Attention = j.UcjbAttention,

        // Distance - calculated during enrichment for flight jobs, otherwise use stored value
        Distance = (double)(j.TotalDistance ?? 0),

        ReadTrackerInfo = j.TucJobReadTracker != null
            ? new ReadTrackerInfoViewModel
            {
                HasBeenRead = j.TucJobReadTracker.HasBeenRead,
                ReadBy = j.TucJobReadTracker.ReadByStaff != null
                    ? FormatFullName(j.TucJobReadTracker.ReadByStaff)
                    : string.Empty,
                ReadDate = j.TucJobReadTracker.ReadTimestamp
            }
            : new ReadTrackerInfoViewModel { HasBeenRead = false },

        PickUpWindowMins = j.PickUpWindowMins,
        DeliverByWindowMins = j.DeliverByWindowMins,

        // Timezones
        PickUpTimeZone = j.PickupTimeZone != null
            ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
            : null,
        DeliveryTimeZone = j.DeliverByTimeZone != null
            ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
            : null,

        Locked = j.UcjbLocked ?? false,
        IsPartnerJob = j.PartnerJobGuid.HasValue,

        // The other tenant's name on a partner pairing. Resolved from the direct
        // PartnerPairing nav; falls back to the most recent change request's
        // pairing for legacy mirrors created before TucJob.PartnerPairingId was
        // being populated (a fresh inbound mirror with no change requests yet
        // shows null, and the UI gracefully falls back to "the partner").
        PartnerTenantName = j.PartnerPairing != null
            ? j.PartnerPairing.PartnerTenantName
            : j.TucJobChangeRequests
                .Where(r => r.UjcrPairing != null && r.UjcrPairing.PartnerTenantName != null)
                .OrderByDescending(r => r.UjcrRequestedAtUtc)
                .Select(r => r.UjcrPairing.PartnerTenantName)
                .FirstOrDefault(),

        // Job item flags - loaded inline from navigation property (3-tier: stop child → own → parent)
        TailLiftPu = j.TucJobItemChildJobs.Any(i => i.Pu == true)
            || j.TucJobItemJobs.Any(i => i.Pu == true)
            || (j.Parent != null && j.Parent.TucJobItemJobs.Any(i => i.ChildJobId == null && i.Pu == true)),
        TailLiftDo = j.TucJobItemChildJobs.Any(i => i.Do == true)
            || j.TucJobItemJobs.Any(i => i.Do == true)
            || (j.Parent != null && j.Parent.TucJobItemJobs.Any(i => i.ChildJobId == null && i.Do == true)),
        DeliverToPrivateRes = j.TucJobItemChildJobs.Any(i => i.PrivateRes == true)
            || j.TucJobItemJobs.Any(i => i.PrivateRes == true)
            || (j.Parent != null && j.Parent.TucJobItemJobs.Any(i => i.ChildJobId == null && i.PrivateRes == true)),

        // Parcel dimensions - 3-tier: stop child items → own items → parent items
        ParcelDimensions = j.TucJobItemChildJobs.Any()
            ? j.TucJobItemChildJobs.Select(i => new ParcelDimensions
            {
                ItemId = i.ItemId,
                ItemName = i.Notes,
                Height = i.Height,
                Depth = i.Depth,
                Length = i.Length,
                Weight = i.Weight,
                Cubic = i.Cubic,
                Barcode = i.Barcode
            }).ToList()
            : j.TucJobItemJobs.Any(i => i.ChildJobId == null)
                ? j.TucJobItemJobs.Where(i => i.ChildJobId == null).Select(i => new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Weight = i.Weight,
                    Cubic = i.Cubic,
                    Barcode = i.Barcode
                }).ToList()
                : j.Parent != null
                    ? j.Parent.TucJobItemJobs.Where(i => i.ChildJobId == null)
                        .Select(i => new ParcelDimensions
                        {
                            ItemId = i.ItemId,
                            ItemName = i.Notes,
                            Height = i.Height,
                            Depth = i.Depth,
                            Length = i.Length,
                            Weight = i.Weight,
                            Cubic = i.Cubic,
                            Barcode = i.Barcode
                        }).ToList()
                    : new List<ParcelDimensions>(),

        // Pallet info - 3-tier: stop child items → own items → parent items
        PalletInfo = j.TucJobItemChildJobs.Any()
            ? j.TucJobItemChildJobs.Select(i => new PalletInfo
            {
                Id = i.JobId,
                Quantity = i.Items,
                ItemId = i.ItemId,
                Weight = i.Weight,
                Length = i.Length ?? 0,
                Depth = i.Depth ?? 0,
                Height = i.Height ?? 0,
                Cubic = i.Cubic.HasValue ? (double)i.Cubic.Value : 0,
                Pu = i.Pu,
                Do = i.Do,
                DgClass = i.Dgclass,
                Notes = i.Notes
            }).ToList()
            : j.TucJobItemJobs.Any(i => i.ChildJobId == null)
                ? j.TucJobItemJobs.Where(i => i.ChildJobId == null).Select(i => new PalletInfo
                {
                    Id = i.JobId,
                    Quantity = i.Items,
                    ItemId = i.ItemId,
                    Weight = i.Weight,
                    Length = i.Length ?? 0,
                    Depth = i.Depth ?? 0,
                    Height = i.Height ?? 0,
                    Cubic = i.Cubic.HasValue ? (double)i.Cubic.Value : 0,
                    Pu = i.Pu,
                    Do = i.Do,
                    DgClass = i.Dgclass,
                    Notes = i.Notes
                }).ToList()
                : j.Parent != null
                    ? j.Parent.TucJobItemJobs.Where(i => i.ChildJobId == null)
                        .Select(i => new PalletInfo
                        {
                            Id = i.JobId,
                            Quantity = i.Items,
                            ItemId = i.ItemId,
                            Weight = i.Weight,
                            Length = i.Length ?? 0,
                            Depth = i.Depth ?? 0,
                            Height = i.Height ?? 0,
                            Cubic = i.Cubic.HasValue ? (double)i.Cubic.Value : 0,
                            Pu = i.Pu,
                            Do = i.Do,
                            DgClass = i.Dgclass,
                            Notes = i.Notes
                        }).ToList()
                    : null,

        // Flight info - loaded inline for root jobs, batch loaded for child jobs
        AssignedFlight = j.TucJobNationwides.Any()
            ? j.TucJobNationwides
                .OrderBy(n => n.UcnwLegNumber)
                .Take(1)
                .SelectMany(
                    first => j.TucJobNationwides.OrderByDescending(n => n.UcnwLegNumber).Take(1),
                    (first, last) => new AssignedFlight
                    {
                        ExpectedDeparture = first.UcnwEtd,
                        DepartureTimeZone = first.DepartureAirportTimeZoneNavigation != null
                            ? first.DepartureAirportTimeZoneNavigation.Name
                            : first.DepartureAirportTimeZone,
                        ExpectedArrival = last.UcnwEta,
                        ArrivalTimeZone = last.ArrivalAirportTimeZoneNavigation != null
                            ? last.ArrivalAirportTimeZoneNavigation.Name
                            : last.ArrivalAirportTimeZone,
                        FlightNumber = first.UcnwFlightNo ?? string.Empty,
                        Notes = first.UcnwNotes,
                        FlightSegments = j.TucJobNationwides
                            .OrderBy(n => n.UcnwLegNumber)
                            .Select(n => new FlightSegmentViewModel
                            {
                                SegmentOrder = n.UcnwLegNumber - 1,
                                CarrierFsCode = n.UcnwFlightNo != null && n.UcnwFlightNo.Length >= 2
                                    ? n.UcnwFlightNo.Substring(0, 2)
                                    : "??",
                                FlightNumber = n.UcnwFlightNo != null && n.UcnwFlightNo.Length > 2
                                    ? n.UcnwFlightNo.Substring(2)
                                    : "????",
                                DepartureTime = n.UcnwEtd ?? SqlMinDateTime,
                                ArrivalTime = n.UcnwEta ?? SqlMinDateTime,
                                DepartureAirportFsCode = n.DepartureAirportFsCode,
                                DepartureAirportName = n.DepartureAirportName,
                                DepartureAirportCity = n.DepartureAirportCity,
                                DepartureAirportCountry = n.DepartureAirportCountry,
                                DepartureAirportTimeZone = n.DepartureAirportTimeZoneNavigation != null
                                    ? n.DepartureAirportTimeZoneNavigation.Name
                                    : n.DepartureAirportTimeZone,
                                DepartureAirportTimeZoneId = n.DepartureAirportTimeZoneId ?? 0,
                                DepartureTerminal = n.DepartureTerminal,
                                ArrivalAirportFsCode = n.ArrivalAirportFsCode,
                                ArrivalAirportName = n.ArrivalAirportName,
                                ArrivalAirportCity = n.ArrivalAirportCity,
                                ArrivalAirportCountry = n.ArrivalAirportCountry,
                                ArrivalAirportTimeZone = n.ArrivalAirportTimeZoneNavigation != null
                                    ? n.ArrivalAirportTimeZoneNavigation.Name
                                    : n.ArrivalAirportTimeZone,
                                ArrivalAirportTimeZoneId = n.ArrivalAirportTimeZoneId ?? 0,
                                ArrivalTerminal = n.ArrivalTerminal,
                                ElapsedTime = n.UcnwEta.HasValue && n.UcnwEtd.HasValue
                                    ? (int)(n.UcnwEta.Value - n.UcnwEtd.Value).TotalMinutes
                                    : 0,
                                AircraftName = n.AircraftName,
                                AirlineName = n.UcnwAirlineName
                            }).ToList()
                    })
                .FirstOrDefault()
            : null,
        IsFlightAssigned = j.TucJobNationwides.Any(),

        CustomJobName = j.CustomJobName,

        // Arrival times
        PickupArrivalTime = j.PickupArrivalTime,
        DeliveryArrivalTime = j.DeliveryArrivalTime
    };
}
