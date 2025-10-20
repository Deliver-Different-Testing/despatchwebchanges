using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Helpers;

public static class JobMappings
{
    private static readonly DateTime SqlMinDateTime = new(1753, 1, 1);

    public static Expression<Func<TucJob, DispatchJobViewModel>> JobDispatchMapping(bool isUsCustomer) =>
        j => new DispatchJobViewModel
        {
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            HasBeenRead = j.TucJobReadTracker != null && j.TucJobReadTracker.HasBeenRead,
            IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.UcjbId,
            ParentId = j.ParentId,
            JobTypeMins = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.Minutes : null,

            InternalStatusId = j.InternalStatus,
            SpeedId = j.UcjbSpeed,
            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            Time = j.UcjbTime,
            Booked = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
            IsFlightJob = j.UcjbSpeedNavigation != null
                          && j.UcjbSpeedNavigation.GroupingId ==
                          (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
            IsAgentJob = j.UcjbSpeedNavigation != null
                         && j.UcjbSpeedNavigation.GroupingId !=
                         (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),

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

            From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : "Unknown",
            ToAddress = j.UcjbToAddr,
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
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,
            PickupContact = j.PickupFromContact,
            DeliveryContact = j.DeliverToContact,

            Direct = j.Direct,
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
            Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
            Vehicle =
                j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName
                    }
                    : null,

            Client = j.UcjbClientCode,
            ClientId = j.UcjbClientId,
            ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,

            JobType = (int)(j.UcjbType ?? 0),
            PickupTime = null,
            DeliveryTime = null,
            AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : null,

            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,

            Done = j.UcjbJobDone,
            PreBook = true,

            PickupFrom = j.UcjbPickUpFrom,
            RootParentId = j.RootParentId,

            RelatedJobs = j.Parent != null && j.Parent.InverseParent.Any()
                ? j
                    .Parent.InverseParent.Select(p => new Suggestion
                    {
                        Id = p.UcjbId,
                        Text = p.UcjbNumber
                    })
                    .ToList()
                : null,

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

            AssignedFlight =
                j.Parent != null
                    ? j
                        .Parent.InverseParent.SelectMany(childJob => childJob.TucJobNationwides)
                        .Select(nj => new AssignedFlight { FlightNumber = nj.UcnwFlightNo })
                        .FirstOrDefault()
                    : j
                        .TucJobNationwides.Select(nj => new AssignedFlight
                        {
                            FlightNumber = nj.UcnwFlightNo
                        })
                        .FirstOrDefault(),

            // Assigned agent
            AssignedAgent =
                j.Agent != null
                    ? new AgentViewModel
                    {
                        AgentName = j.Agent.UcagName,
                        AgentEmail = j.Agent.UcagFax,
                        AgentPhone = j.Agent.UcagPhone
                    }
                    : null,
            Locked = j.UcjbLocked ?? false,

            ConNote = j.Parent != null ? j.Parent.Connote : j.Connote,
            FollowupTime = j.FollowupTime,
            Van = j.UcjbVan,
            Truck = j.Truck ?? false,
            DgClass = j.Dgclass,
            AllowSplit = (j.ParentId == j.UcjbId && (j.InverseParent == null || !j.InverseParent.Any())) 
                         || j.ParentId == null,
            
            PickUpTimeZone = j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
            DeliveryTimeZone = j.DeliverByTimeZone != null
                ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                : null
        };

    public static readonly Expression<Func<TucJob, JobViewModel>> JobMapping = j => new JobViewModel
    {
        ClientId = j.UcjbClientId,
        Id = j.UcjbId,
        JobNo = j.UcjbNumber,
        Time = j.UcjbTime,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.UcjbDate),
        Booked = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
        DispatchTime = j.UcjbDispTime,
        CreatedDate = j.UcjbDate,
        ScheduleName = j.ScheduleName,
        FollowupTime = j.FollowupTime,
        Void = j.UcjbVoid,
        LoggedInContactName = j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname,
        BookingSource = j.Source != null
            ? new Suggestion
            {
                Id = j.Source.SourceId,
                Text = j.Source.Name
            }
            : null,

        PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime : null,
        DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime : null,

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

        // Tail Lift
        TailLiftPu = j.TucJobItemJobs != null && j.TucJobItemJobs.Any(i => i.Pu == true),
        TailLiftDo = j.TucJobItemJobs != null && j.TucJobItemJobs.Any(i => i.Do == true),
        DeliverToPrivateRes = j.TucJobItemJobs != null && j.TucJobItemJobs.Any(i => i.PrivateRes == true),

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

        AssignedFlight =
            j.Parent != null && j.Parent.InverseParent.Any() == true
                ? j.Parent.InverseParent.SelectMany(childJob => childJob.TucJobNationwides)
                    .Select(nj => new AssignedFlight
                    {
                        ExpectedArrival = nj.UcnwEta,
                        ArrivalTimeZone = nj.ArrivalAirportTimeZoneNavigation.Name,
                        ExpectedDeparture = nj.UcnwEtd,
                        DepartureTimeZone = nj.DepartureAirportTimeZoneNavigation.Name,
                        FlightNumber = nj.UcnwFlightNo,
                        Notes = nj.UcnwNotes,
                        // First, check if there are any flight segments
                        FlightSegments =
                            j.Parent.InverseParent.SelectMany(childJob =>
                                    childJob.TucJobNationwides
                                )
                                .Any() == true
                                ? j
                                    .Parent.InverseParent.SelectMany(childJob =>
                                        childJob.TucJobNationwides
                                    )
                                    .OrderBy(f => f.UcnwLegNumber)
                                    .Select(segment => new FlightSegmentViewModel
                                    {
                                        SegmentOrder = segment.UcnwLegNumber - 1,
                                        CarrierFsCode =
                                            !string.IsNullOrEmpty(segment.UcnwFlightNo)
                                            && segment.UcnwFlightNo.Length >= 2
                                                ? segment.UcnwFlightNo.Substring(0, 2)
                                                : "??",
                                        FlightNumber =
                                            !string.IsNullOrEmpty(segment.UcnwFlightNo)
                                            && segment.UcnwFlightNo.Length > 2
                                                ? segment.UcnwFlightNo.Substring(2)
                                                : "????",
                                        DepartureTime = segment.UcnwEtd ?? SqlMinDateTime,
                                        ArrivalTime = segment.UcnwEta ?? SqlMinDateTime,
                                        DepartureAirportFsCode = segment.DepartureAirportFsCode,
                                        DepartureAirportName = segment.DepartureAirportName,
                                        DepartureAirportCity = segment.DepartureAirportCity,
                                        DepartureAirportCountry = segment.DepartureAirportCountry,
                                        DepartureAirportTimeZone = segment.DepartureAirportTimeZoneNavigation.Name,
                                        DepartureAirportTimeZoneId =
                                            segment.DepartureAirportTimeZoneId ?? 0,
                                        DepartureTerminal = segment.DepartureTerminal,
                                        ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                                        ArrivalAirportName = segment.ArrivalAirportName,
                                        ArrivalAirportCity = segment.ArrivalAirportCity,
                                        ArrivalAirportCountry = segment.ArrivalAirportCountry,
                                        ArrivalAirportTimeZone = segment.ArrivalAirportTimeZoneNavigation.Name,
                                        ArrivalAirportTimeZoneId =
                                            segment.ArrivalAirportTimeZoneId ?? 0,
                                        ArrivalTerminal = segment.ArrivalTerminal,
                                        ElapsedTime = (int)(
                                            segment.UcnwEta.HasValue && segment.UcnwEtd.HasValue
                                                ? (segment.UcnwEta.Value - segment.UcnwEtd.Value).TotalMinutes
                                                : 0
                                        ),
                                        AircraftName = segment.AircraftName,
                                        AirlineName = segment.UcnwAirlineName
                                    })
                                    .ToList()
                                : new List<FlightSegmentViewModel>() // Empty list if no segments
                    })
                    .FirstOrDefault()
                : j.TucJobNationwides.Any() == true
                    ? j
                        .TucJobNationwides.Select(nj => new AssignedFlight
                        {
                            ExpectedArrival = nj.UcnwEta,
                            ArrivalTimeZone = nj.ArrivalAirportTimeZoneNavigation.Name,
                            ExpectedDeparture = nj.UcnwEtd,
                            DepartureTimeZone = nj.DepartureAirportTimeZoneNavigation.Name,
                            FlightNumber = nj.UcnwFlightNo,
                            Notes = nj.UcnwNotes,
                            // Check if there are any flight segments
                            FlightSegments =
                                j.TucJobNationwides.Count != 0 == true
                                    ? j
                                        .TucJobNationwides.OrderBy(f => f.UcnwLegNumber)
                                        .Select(segment => new FlightSegmentViewModel
                                        {
                                            SegmentOrder = segment.UcnwLegNumber - 1,
                                            CarrierFsCode =
                                                !string.IsNullOrEmpty(segment.UcnwFlightNo)
                                                && segment.UcnwFlightNo.Length >= 2
                                                    ? segment.UcnwFlightNo.Substring(0, 2)
                                                    : "??",
                                            FlightNumber =
                                                !string.IsNullOrEmpty(segment.UcnwFlightNo)
                                                && segment.UcnwFlightNo.Length > 2
                                                    ? segment.UcnwFlightNo.Substring(2)
                                                    : "????",
                                            DepartureTime = segment.UcnwEtd ?? SqlMinDateTime,
                                            ArrivalTime = segment.UcnwEta ?? SqlMinDateTime,
                                            DepartureAirportFsCode = segment.DepartureAirportFsCode,
                                            DepartureAirportName = segment.DepartureAirportName,
                                            DepartureAirportCity = segment.DepartureAirportCity,
                                            DepartureAirportCountry = segment.DepartureAirportCountry,
                                            DepartureAirportTimeZone = segment.DepartureAirportTimeZoneNavigation.Name,
                                            DepartureAirportTimeZoneId =
                                                segment.DepartureAirportTimeZoneId ?? 0,
                                            DepartureTerminal = segment.DepartureTerminal,
                                            ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                                            ArrivalAirportName = segment.ArrivalAirportName,
                                            ArrivalAirportCity = segment.ArrivalAirportCity,
                                            ArrivalAirportCountry = segment.ArrivalAirportCountry,
                                            ArrivalAirportTimeZone = segment.ArrivalAirportTimeZoneNavigation.Name,
                                            ArrivalAirportTimeZoneId =
                                                segment.ArrivalAirportTimeZoneId ?? 0,
                                            ArrivalTerminal = segment.ArrivalTerminal,
                                            ElapsedTime = (int)(
                                                segment.UcnwEta.HasValue && segment.UcnwEtd.HasValue
                                                    ? (segment.UcnwEta.Value - segment.UcnwEtd.Value).TotalMinutes
                                                    : 0
                                            ),
                                            AircraftName = segment.AircraftName,
                                            AirlineName = segment.UcnwAirlineName
                                        })
                                        .ToList()
                                    : new List<FlightSegmentViewModel>() // Empty list if no segments
                        })
                        .FirstOrDefault()
                    : null,

        // Assigned agent
        AssignedAgent =
            j.Agent != null
                ? new AgentViewModel
                {
                    AgentId = j.Agent.UcagId,
                    AgentName = j.Agent.UcagName,
                    AgentRanking =
                        j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : null,
                    AgentEmail = j.Agent.UcagFax,
                    AgentPhone = j.Agent.UcagPhone
                }
                : null,

        // Tracking info
        TrackingMethod = j.TrackingMethod,
        TrackingMobile = j.TrackingMobile,
        TrackingEmail = j.TrackingEmail,

        // Delivery details
        PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
        Return = j.UcjbReturn,
        SaturdayDelivery = j.SaturdayDelivery,
        CompletedTime = j.UcjbComplTime,
        UdStatus = j.UndeliverableLocation != null ? j.UndeliverableLocation.Name : string.Empty,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact,

        // Location data
        PickUpLatitude = j.PickUpLatitude,

        PickUpLongitude = j.PickUpLongitude,
        DeliveryLatitude = j.DeliveryLatitude,
        DeliveryLongitude = j.DeliveryLongitude,

        // Client information
        Client = j.UcjbClientCode,
        ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone,
        PodName = j.UcjbPodname,
        PuTime = j.PickUpTime,

        // Job characteristics
        Weight = j.UcjbWeight,
        CalculateDimsOncePerJob = j.DimensionsType == 1,
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
        ParcelDimensions = GetPackagesForJob(j, j.Parent,
            j.TucJobItemJobs, j.Parent.TucJobItemJobs,
            j.TucJobItemChildJobs),

        // Job status and details
        Done = j.UcjbJobDone,
        AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : null,
        AlertLateDelivery = j.UcjbClient != null ? j.UcjbClient.AlertLateDelivery : null,
        Lp = j.UcjbLatePick,
        Ld = j.UcjbLateDel,
        Items = j.UcjbQty,

        PickupFrom = j.UcjbPickUpFrom,
        Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
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
        OurRef = j.UcjbOurRef,

        // Pricing 
        Charge = j.Parent != null && j.Parent.PricingBreakdownJobs != null && j.Parent.PricingBreakdownJobs.Any() == true 
            ? j.Parent.PricingBreakdownJobs.Sum(p => p.ChargeAmount) 
            : j.PricingBreakdownChildJobs != null && j.PricingBreakdownChildJobs.Any() == true 
                ? j.PricingBreakdownChildJobs.Sum(p => p.ChargeAmount) 
                : j.UcjbAmount,

        // Status
        StatusId = j.UcjbStatus,
        Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
        StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
        InternalStatusId = j.InternalStatus,
        ConNote = j.ParentId != null ? j.Parent.Connote : j.Connote,

        // Checkboxes
        Reprice = j.Reprice,

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
        PalletInfo = j.TucJobItemJobs != null ?
            j.TucJobItemJobs.Select(i => new PalletInfo
            {
                Id = i.JobId,
                Quantity = i.Items,
                ItemId = i.ItemId,
                Weight = i.Weight,
                Length = i.Length ?? 0,
                Depth = i.Depth ?? 0,
                Height = i.Height ?? 0,
                Pu = i.Pu,
                Do = i.Do,
                DgClass = i.Dgclass,
                Notes = i.Notes
            })
            .ToList() : null,

        // Related jobs
        RelatedJobs = null,

        IsArchived = false,
        PreBook = false,
        DeliverByTime = j.DeliverByTime,
        Attention = j.UcjbAttention,

        Distance =
            j.ToAirportId != null && j.FromAirportId != null
                ? DistanceCalculator.CalculateDistance(
                    j.PickUpLatitude ?? 0,
                    j.PickUpLongitude ?? 0,
                    j.DeliveryLatitude ?? 0,
                    j.DeliveryLongitude ?? 0
                )
                : (double)(j.TotalDistance ?? 0),

        ReadTrackerInfo =
            j.TucJobReadTracker != null
                ? new ReadTrackerInfoViewModel
                {
                    HasBeenRead = j.TucJobReadTracker.HasBeenRead,
                    ReadBy =
                        j.TucJobReadTracker.ReadByStaff != null
                            ? FormatFullName(j.TucJobReadTracker.ReadByStaff)
                            : string.Empty,
                    ReadDate = j.TucJobReadTracker.ReadTimestamp
                }
                : new ReadTrackerInfoViewModel { HasBeenRead = false },

        PickUpWindowMins = j.PickUpWindowMins,
        DeliverByWindowMins = j.DeliverByWindowMins,

        // Timezones
        PickUpTimeZone =
            j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
        DeliveryTimeZone =
            j.DeliverByTimeZone != null
                ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                : null,

        Locked = j.UcjbLocked ?? false
    };

    public static readonly Expression<Func<TblBulkJob, JobViewModel>> BulkJobMapping = j => new JobViewModel
    {
        ClientId = j.ClientId,
        Id = j.BulkJobId,
        JobNo = j.JobNumber,
        Time = j.BookTime,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.BookDate),
        Booked = CombineDateAndTime(j.BookDate, j.BookTime),
        CreatedDate = j.BookDate,
        ScheduleName = j.ScheduleName,
        Void = j.Void,
        BookingSource = j.Source != null
            ? new Suggestion
            {
                Id = j.Source.SourceId,
                Text = j.Source.Name
            }
            : null,


        PickupTime = j.SpeedNavigation != null ? j.SpeedNavigation.PickupTime : null,
        DeliveryTime = j.SpeedNavigation != null ? j.SpeedNavigation.DeliveryTime : null,

        // Courier
        Courier = j.Courier != null ? j.Courier.Code : null,
        CourierData =
            j.Courier != null
                ? new CourierData
                {
                    Courier = j.Courier.Code,
                    CourierId = j.Courier.UccrId,
                    CourierMobile = j.Courier.UccrMobile,
                    CourierName = j.Courier.UccrName + " " + j.Courier.UccrSurname
                }
                : null,
        AssignedCourier =
            j.Courier != null
                ? new Suggestion
                {
                    Id = j.Courier.UccrId,
                    Text = j.Courier.UccrName + " " + j.Courier.UccrSurname
                }
                : null,

        // Tail Lift
        TailLiftPu = j.TblBulkJobItems != null && j.TblBulkJobItems.Any(i => i.Pu == true),
        TailLiftDo = j.TblBulkJobItems != null && j.TblBulkJobItems.Any(i => i.Do == true),
        DeliverToPrivateRes = j.TblBulkJobItems != null && j.TblBulkJobItems.Any(i => i.PrivateRes == true),

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
            Latitude = decimal.Parse(j.PickUpLatitude),
            Longitude = decimal.Parse(j.PickUpLongitude)
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
            Latitude = decimal.Parse(j.DeliveryLatitude),
            Longitude = decimal.Parse(j.DeliveryLongitude)
        },

        // Tracking info
        TrackingMethod = j.TrackingMethod,
        TrackingMobile = j.TrackingMobile,
        TrackingEmail = j.TrackingEmail,

        // Delivery details
        PrivateRes = j.DeliverToPrivateBusiness,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact,

        // Location data
        PickUpLatitude = decimal.Parse(j.PickUpLatitude),
        PickUpLongitude = decimal.Parse(j.PickUpLongitude),
        DeliveryLatitude = decimal.Parse(j.DeliveryLatitude),
        DeliveryLongitude = decimal.Parse(j.DeliveryLongitude),

        // Client information
        Client = j.ClientCode,
        ClientName = j.Client != null ? j.Client.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone,

        // Job characteristics
        Weight = j.Weight.HasValue ? (double)j.Weight : null,
        ToAddress = j.ToAddress,
        JobType = j.JobRelationshipTypeId ?? 0,
        JobTypeDescription = GetJobTypeDescription(j.JobRelationshipTypeId ?? 0),

        // Job status and details
        Done = j.Done,
        AlertLatePickup = j.Client != null ? j.Client.AlertLatePickUp : null,
        AlertLateDelivery = j.Client != null ? j.Client.AlertLateDelivery : null,
        Items = j.Qty,

        FromContactName = j.PickupFromContact,
        FromContactNumber = j.PickupFromPhone,

        // Speed and job type information
        Speed = j.SpeedNavigation != null ? j.SpeedNavigation.ShortName : null,
        SpeedName = j.SpeedNavigation != null ? j.SpeedNavigation.UcjtName : null,
        SpeedId = j.Speed,

        // References and amounts
        RefA = j.ClientRefa,
        RefB = j.ClientRefb,
        Charge = j.Amount,
        OurRef = j.OurRef,

        // Status
        StatusId = j.JobStatus,
        Status = j.JobStatusNavigation != null ? j.JobStatusNavigation.UcjsCode : null,
        StatusName = j.JobStatusNavigation != null ? j.JobStatusNavigation.UcjsName : null,

        IsArchived = false,
        PreBook = false,
        IsBulkJob = true,

        // Timezones
        PickUpTimeZone =
            j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
        DeliveryTimeZone =
            j.DeliverByTimeZoneId != null
                ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                : null,

        ParcelDimensions = GetPackagesForBulkJob(j, j.Parent,
            j.TblBulkJobItems, j.Parent.TblBulkJobItems,
            j.TblBulkJobItems)
    };

    public static readonly Expression<Func<TucJobArchive, JobViewModel>> JobArchiveMapping = j => new JobViewModel
    {
        ClientId = j.UcjbClientId,
        Id = j.UcjbId,
        JobNo = j.UcjbNumber,
        Time = j.UcjbTime,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.UcjbDate),
        Booked = j.UcjbDate.HasValue
            ? CombineDateAndTime(j.UcjbDate.Value, j.UcjbTime)
            : SqlMinDateTime,
        DispatchTime = j.UcjbDispTime,
        CreatedDate = j.UcjbDate,
        ScheduleName = j.ScheduleName,
        FollowupTime = j.FollowupTime,
        Void = j.UcjbVoid,
        LoggedInContactName = j.LoggedInContact != null
            ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
            : string.Empty,

        PickupTime = null,
        DeliveryTime = null,

        Courier = null,
        CourierData = j.UcjbCourierId.HasValue
            ? new CourierData { CourierId = j.UcjbCourierId }
            : null,
        AssignedCourier = j.UcjbCourierId.HasValue
            ? new Suggestion { Id = j.UcjbCourierId.Value }
            : null,

        // Address information - directly available in the archive
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
                ? new AgentViewModel
                {
                    AgentId = j.Agent.UcagId,
                    AgentName = j.Agent.UcagName,
                    AgentEmail = j.Agent.UcagFax,
                    AgentPhone = j.Agent.UcagPhone
                }
                : null,

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
        CalculateDimsOncePerJob = j.DimensionsType == 1,
        ToAddress = j.UcjbToAddr,
        JobType = (int)(j.UcjbType ?? 0),
        JobTypeDescription = GetJobTypeDescription(j.UcjbType ?? 0),
        Direct = j.Direct,
        Van = j.UcjbVan,
        VanOk = j.VanOk,
        Truck = j.Truck,
        DgClass = j.Dgclass,
        DgDocumentation = j.Dgdocument,
        HasDgDocsString = j.Dgdocument.HasValue ? "Yes" : "No",

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
        OurRef = j.UcjbOurRef,

        // Pricing
        Charge = j.Parent != null && j.Parent.PricingBreakdowns != null && j.Parent.PricingBreakdowns.Any() == true
            ? j.Parent.PricingBreakdowns.Sum(p => p.ChargeAmount)
            : j.PricingBreakdowns != null && j.PricingBreakdowns.Any() == true
                ? j.PricingBreakdowns.Sum(p => p.ChargeAmount)
                : j.UcjbAmount ?? 0,

        StatusId = j.UcjbStatus,
        InternalStatusId = j.InternalStatus,
        ConNote = j.Connote,

        // Checkboxes
        Reprice = j.Reprice,

        // Size - has navigation in the archive
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
        Attention = j.UcjbAttention,

        Distance =
            j.ToAirportId.HasValue && j.FromAirportId.HasValue
                ? DistanceCalculator.CalculateDistance(
                    j.PickUpLatitude ?? 0,
                    j.PickUpLongitude ?? 0,
                    j.DeliveryLatitude ?? 0,
                    j.DeliveryLongitude ?? 0
                )
                : (double)(j.TotalDistance ?? 0),

        PickUpWindowMins = j.PickUpWindowMins,
        DeliverByWindowMins = j.DeliverByWindowMins,

        // Timezones
        PickUpTimeZone =
            j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
        DeliveryTimeZone =
            j.DeliverByTimeZone != null
                ? new Suggestion
                {
                    Id = j.DeliverByTimeZone.Id,
                    Text = j.DeliverByTimeZone.Name
                }
                : null,
 
        Locked = j.UcjbLocked != null && j.UcjbLocked != 0
    };

    public static readonly Expression<Func<TucJobBooking, JobRecurringViewModel>> JobRecurringMapping = j =>
        new JobRecurringViewModel
        {
            ClientId = j.UcbkClientId,
            Id = j.UcbkId,
            JobNo = j.UcbkJobNumber,
            CustomJobName = j.CustomJobName,
            Time = j.UcbkTime,
            RootParentId = j.RootParentId,
            RelatedJobs = null,

            Date = FormatDate(j.UcbkDate),
            Booked = j.UcbkDate.HasValue
                ? CombineDateAndTime(j.UcbkDate.Value, j.UcbkTime)
                : SqlMinDateTime,
            CreatedDate = j.UcbkDate,
            ScheduleName = j.ScheduleName,
            LoggedInContactName = j.LoggedInContact != null
                ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
                : null,
            BookingSource = j.Source != null
                ? new Suggestion
                {
                    Id = j.Source.SourceId,
                    Text = j.Source.Name
                }
                : null,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.Courier != null
                ? new CourierData { CourierId = j.Courier.UccrId, CourierName = j.Courier.UccrName }
                : null,
            AssignedCourier = j.Courier != null
                ? new Suggestion { Id = j.Courier.UccrId, Text = j.Courier.UccrName }
                : null,

            // Tail Lift
            TailLiftPu = j.TucJobBookingItemBookings != null && j.TucJobBookingItemBookings.Any(i => i.Pu == true),
            TailLiftDo = j.TucJobBookingItemBookings != null && j.TucJobBookingItemBookings.Any(i => i.Do == true),
            DeliverToPrivateRes = j.TucJobBookingItemBookings != null &&
                                  j.TucJobBookingItemBookings.Any(i => i.PrivateRes == true),

            // Address information - directly available in the archive
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
            CalculateDimsOncePerJob = j.DimensionsType == 1,
            ToAddress = j.UcbkToAddr,
            JobType = j.UcbkType,
            JobTypeDescription = GetJobTypeDescription(j.UcbkType ?? 0),
            Direct = j.Direct,
            Van = j.UcbkVan,
            VanOk = j.VanOk,
            Truck = j.Truck,
            DgClass = j.Dgclass,
            DgDocumentation = j.Dgdocument,
            HasDgDocsString = j.Dgdocument.HasValue ? "Yes" : "No",

            // Job status and details
            Done = j.UcbkDone,
            Items = j.Quantity,

            PickupFrom = j.UcbkPickUpFrom.HasValue ? (short)j.UcbkPickUpFrom : null,
            FromContactName = j.PickupFromContact,

            // Speed and job type information
            SpeedId = j.UcbkSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcbkClientRefa,
            RefB = j.UcbkClientRefb,
            OurRef = j.UcbkOurRef,

            // Pricing
            Charge = j.BookingParent != null && j.BookingParent.PricingBreakdowns != null
                ? j.BookingParent.PricingBreakdowns.Sum(p => p.ChargeAmount)
                : j.PricingBreakdowns != null
                    ? j.PricingBreakdowns.Sum(p => p.ChargeAmount)
                    : j.UcbkAmount ?? 0,

            // Size - has navigation in the archive
            Size =
                j.UcbkSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcbkSizeNavigation.VehicleSizeId,
                        Text = j.UcbkSizeNavigation.VehicleName
                    }
                    : null,
            IsArchived = false,
            PreBook = true,
            DeliverByTime = j.DeliverByTime,
            Attention = j.UcbkAttention,

            ParcelDimensions =
                j.BookingParent == null || j.ParentId == j.UcbkId
                    ? j.TucJobBookingItemBookings.Select(p => new ParcelDimensions
                        {
                            ItemId = p.ItemId,
                            ItemName = p.Notes,
                            Height = p.Height,
                            Depth = p.Depth,
                            Length = p.Length
                        })
                        .ToList()
                    : j.BookingParent.TucJobBookingItemBookings.Select(p => new ParcelDimensions
                        {
                            ItemId = p.ItemId,
                            ItemName = p.Notes,
                            Height = p.Height,
                            Depth = p.Depth,
                            Length = p.Length
                        })
                        .ToList(),

            Distance =
                j.ToAirportId.HasValue && j.FromAirportId.HasValue
                    ? DistanceCalculator.CalculateDistance(
                        j.PickUpLatitude ?? 0,
                        j.PickUpLongitude ?? 0,
                        j.DeliveryLatitude ?? 0,
                        j.DeliveryLongitude ?? 0
                    )
                    : (double)(j.TotalDistance ?? 0),

            // Added recurring job fields
            InActiveBy =
                j.UcbkInActiveByNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcbkInActiveBy.Value,
                        Text = FormatFullName(j.UcbkInActiveByNavigation)
                    }
                    : null,
            InActiveDate = j.UcbkInActiveDate,
            FirstDue = j.UcbkFirstDue,
            NextDue = j.UcbkNextDue,
            LastDone = j.UcbkDateDone,
            StopDate = j.StopDate,
            RestartDate = j.RestartDate,
            RunName = j.RunName,
            Active = j.UcbkActive,

            // Added new fields for scheduling
            DaysOfWeek = j.UcbkDaysInt,
            Frequency = j.UcbkFrequency ?? 0,
            HolidayDeliveryOption = j.HolidayDeliveryOption,

            PickUpWindowMins = j.PickUpWindowMins,
            DeliverByWindowMins = j.DeliverByWindowMins,

            // Timezones
            PickUpTimeZone =
                j.PickupTimeZone != null
                    ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                    : null,
            DeliveryTimeZone =
                j.DeliverByTimeZone != null
                    ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                    : null
        };

    public static readonly Expression<Func<TucJob, JobLateCallDto>> JobLateCallMapping =
        j => new JobLateCallDto
        {
            Id = j.UcjbId,
            ClientId = j.UcjbClientId ?? 0,
            PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime ?? 0 : 0,
            DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime ?? 0 : 0,
            AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : 0,
            AlertLateDelivery = j.UcjbClient != null ? j.UcjbClient.AlertLateDelivery : 0,
            JobTime = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
            BookedSpeed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : string.Empty,
            NotifiedSpeed = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName
                : j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName
                : string.Empty
        };

    private static string FormatDate(DateTime? date)
    {
        var dateToUse = date ?? SqlMinDateTime;
        return dateToUse.ToString("MM/dd/yyyy");
    }

    private static DateTime CombineDateAndTime(DateTime date, DateTime? time)
    {
        return new DateTime(
            date.Year,
            date.Month,
            date.Day,
            time?.Hour ?? 0,
            time?.Minute ?? 0,
            time?.Second ?? 0
        );
    }

    private static string FormatFullName(TucStaff staff) =>
        staff.UcstFirstName + " " + staff.UcstLastName;

    private static string GetJobTypeDescription(double? jobTypeId)
    {
        var jobType = (LateEventType?)(jobTypeId ?? (int)LateEventType.Pickup);
        return jobType switch
        {
            LateEventType.Pickup => "Pickup",
            LateEventType.Delivery => "Delivery",
            LateEventType.ThirdParty => "3rd-Party",
            _ => "Pickup"
        };
    }

    private static List<ParcelDimensions> GetPackagesForJob(
        TucJob job,
        TucJob parent,
        ICollection<TucJobItem> jobItems,
        ICollection<TucJobItem> parentJobItems,
        ICollection<TucJobItem> childJobItems)
    {
        // Priority 1: Child items if available
        if (HasItems(childJobItems))
            return ConvertToParcelDimensions(childJobItems);

        // Priority 2: Job items if this is a root job or self-referencing job
        if ((parent == null || job.ParentId == job.UcjbId) && HasItems(jobItems))
            return ConvertToParcelDimensions(jobItems);

        // Priority 3: Parent items as fallback
        return ConvertToParcelDimensions(parentJobItems);
    }

    private static bool HasItems(ICollection<TucJobItem> items) =>
        items is { Count: > 0 };

    private static List<ParcelDimensions> ConvertToParcelDimensions(ICollection<TucJobItem> items) =>
        items?.Select(CreateParcelDimensions).ToList() ?? [];

    private static ParcelDimensions CreateParcelDimensions(TucJobItem item)
    {
        return new ParcelDimensions
        {
            ItemId = item.ItemId,
            ItemName = item.Notes,
            Height = item.Height,
            Depth = item.Depth,
            Length = item.Length,
        };
    }

    private static List<ParcelDimensions> GetPackagesForBulkJob(
        TblBulkJob job,
        TblBulkJob parent,
        ICollection<TblBulkJobItem> jobItems,
        ICollection<TblBulkJobItem> parentJobItems,
        ICollection<TblBulkJobItem> childJobItems)
    {
        // Priority 1: Child items if available
        if (HasItems(childJobItems))
            return ConvertToParcelDimensions(childJobItems);

        // Priority 2: Job items if this is a root job or self-referencing job
        if ((parent == null || job.ParentId == job.BulkJobId) && HasItems(jobItems))
            return ConvertToParcelDimensions(jobItems);

        // Priority 3: Parent items as fallback
        return ConvertToParcelDimensions(parentJobItems);
    }

    private static bool HasItems(ICollection<TblBulkJobItem> items) =>
        items is { Count: > 0 };

    private static List<ParcelDimensions> ConvertToParcelDimensions(ICollection<TblBulkJobItem> items) =>
        items?.Select(CreateParcelDimensions).ToList() ?? [];

    private static ParcelDimensions CreateParcelDimensions(TblBulkJobItem item)
    {
        return new ParcelDimensions
        {
            ItemId = item.ItemId,
            ItemName = item.Notes,
            Height = item.Height,
            Depth = item.Depth,
            Length = item.Length
        };
    }

    public static readonly Expression<Func<TucJobBooking, PrebookListViewModel>> ToPrebookListViewModel = j =>
        new PrebookListViewModel
        {
            Id = j.UcbkId,
            Booked = j.UcbkDate.HasValue && j.UcbkTime.HasValue
                ? new DateTime(
                    j.UcbkDate.Value.Year,
                    j.UcbkDate.Value.Month,
                    j.UcbkDate.Value.Day,
                    j.UcbkTime.Value.Hour,
                    j.UcbkTime.Value.Minute,
                    j.UcbkTime.Value.Second
                )
                : DateTime.MinValue,
            NextDueTime = j.UcbkNextDue,
            Client = j.UcbkClientCode,
            JobNo = j.UcbkJobNumber,
            ClientId = j.UcbkClientId,
            Courier = j.Courier != null ? j.Courier.Code : null,
            Speed = j.UcbkSpeedNavigation != null ? j.UcbkSpeedNavigation.UcjtName : null,
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
            CustomJobName = j.CustomJobName
        };
}