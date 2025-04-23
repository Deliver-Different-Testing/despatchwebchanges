using System;
using System.Linq;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Helpers;

public static class JobMappings
{
    private static readonly int[] SourceArray = [41, 42, 43, 51, 52];

    public static readonly Expression<Func<TucJob, DispatchJobViewModel>> JobDispatchMapping =
        j => new DispatchJobViewModel
        {
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            HasBeenRead = j.TucJobReadTracker != null && j.TucJobReadTracker.HasBeenRead,

            SpeedId = j.UcjbSpeed,
            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            Time = j.UcjbTime,
            Booked = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
            Remain = CalculateRemainTime(j, j.UcjbSpeedNavigation),

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

            Direct = j.Direct,
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
            Notify = j.NotifiedJobType.UcjtName,
            Vehicle = j.UcjbSizeNavigation != null
                ? new Suggestion
                {
                    Id = j.UcjbSizeNavigation.VehicleSizeId,
                    Text = j.UcjbSizeNavigation.VehicleName
                }
                : null,

            Client = j.UcjbClientCode,
            ClientId = j.UcjbClientId,
            JobType = (int)(j.UcjbType ?? 0),
            PickupTime = null,
            DeliveryTime = null,
            AlertLatePickup = j.UcjbClient.AlertLatePickUp,

            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,

            Done = j.UcjbJobDone,
            PreBook = true,

            PickupFrom = (short)j.UcjbPickUpFrom,
            RootParentId = j.RootParentId,

            RelatedJobs = j
                .Parent.InverseParent.Select(p => new Suggestion
                {
                    Id = p.UcjbId,
                    Text = p.UcjbNumber
                })
                .ToList(),

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

            AssignedFlight = j
                .TucJobNationwides.Select(nj => new AssignedFlight
                {
                    FlightNumber = nj.UcnwFlightNo,
                })
                .FirstOrDefault(),

            // Assigned agent
            AssignedAgent =
                j.Agent != null
                    ? new AgentViewModel
                    {
                        AgentName = j.Agent.UcagName,
                    }
                    : null,
        };

    public static readonly Expression<Func<TucJob, JobViewModel>> JobMapping =
        j => new JobViewModel
        {
            ClientId = j.UcjbClientId,
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            Time = j.UcjbTime,
            RootParentId = j.RootParentId,
            Date = j.UcjbDate.ToString("MM/dd/yyyy"),
            Booked = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
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
                    ArrivalTimeZone = j.ToAirport.Timezone,
                    ExpectedDeparture = nj.UcnwEtd,
                    DepartureTimeZone = j.FromAirport.Timezone,
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
            ParcelDimensions = j.ParentId == null
                ? j.TucJobItems.Select(p => new ParcelDimensions
                    {
                        ItemId = p.ItemId,
                        ItemName = p.Notes,
                        Height = p.Height,
                        Depth = p.Depth,
                        Length = p.Length
                    })
                    .ToList()
                : j.Parent.TucJobItems.Select(p => new ParcelDimensions
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
            Charge = j.ParentId == null
                ? $"${j.PricingBreakdowns.Sum(p => p.ChargeAmount):F2}"
                : $"${j.Parent.PricingBreakdowns.Sum(p => p.ChargeAmount):F2}",
            OurRef = j.UcjbOurRef,

            // Status
            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            InternalStatusId = j.InternalStatus,

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
            Attention = j.UcjbAttention,

            Distance = j.ToAirportId.HasValue && j.FromAirportId.HasValue ?
                DistanceCalculator.CalculateDistance(
                    j.PickUpLatitude  ?? 0,
                    j.PickUpLongitude ?? 0,
                    j.DeliveryLatitude ?? 0,
                    j.DeliveryLongitude ?? 0) :  0, // ToDo: Add Kerran's new field

            ReadTrackerInfo = j.TucJobReadTracker != null ?
                new ReadTrackerInfoViewModel
            {
                HasBeenRead = j.TucJobReadTracker.HasBeenRead,
                ReadBy = j.TucJobReadTracker.ReadByStaff != null
                    ? FormatFullName(j.TucJobReadTracker.ReadByStaff)
                    : string.Empty,
                ReadDate = j.TucJobReadTracker.ReadTimestamp
            } : new ReadTrackerInfoViewModel
                {
                    HasBeenRead = false
                },

            PickUpWindowMins = j.PickUpWindowMins,
            DeliverByWindowMins = j.DeliverByWindowMins
        };

    public static readonly Expression<Func<TucJobArchive, JobViewModel>> JobArchiveMapping =
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
            Reprice = j.Reprice,

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
            Attention = j.UcjbAttention,

            Distance = j.ToAirportId.HasValue && j.FromAirportId.HasValue ?
                DistanceCalculator.CalculateDistance(
                    j.PickUpLatitude  ?? 0,
                    j.PickUpLongitude ?? 0,
                    j.DeliveryLatitude ?? 0,
                    j.DeliveryLongitude ?? 0) :  0, // ToDo: Add Kerran's new field

            PickUpWindowMins = j.PickUpWindowMins,
            DeliverByWindowMins = j.DeliverByWindowMins
        };

    public static readonly Expression<Func<TucJobBooking, JobRecurringViewModel>> JobRecurringMapping =
        j => new JobRecurringViewModel
        {
            ClientId = j.UcbkClientId,
            Id = j.UcbkId,
            JobNo = j.UcbkJobNumber,
            Time = j.UcbkTime,
            RootParentId = j.RootParentId,
            Date = j.UcbkDate.HasValue ? j.UcbkDate.Value.ToString("MM/dd/yyyy") : null,
            Booked = j.UcbkDate.HasValue ? CombineDateAndTime(j.UcbkDate.Value, j.UcbkTime) : DateTime.MinValue,
            CreatedDate = j.UcbkDate,
            ScheduleName = j.ScheduleName,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.CourierId.HasValue
                ? new CourierData { CourierId = j.CourierId, CourierName = j.Courier.UccrName}
                : null,
            AssignedCourier = j.CourierId.HasValue
                ? new Suggestion { Id = j.CourierId.Value, Text = j.Courier.UccrName }
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
            JobType = j.UcbkType ?? 0,
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
            IsArchived = false,
            PreBook = true,
            DeliverByTime = j.DeliverByTime,
            Attention = j.UcbkAttention,

            ParcelDimensions = j.ParentId == null
                ? j.TucJobBookingItems.Select(p => new ParcelDimensions
                    {
                        ItemId = p.ItemId,
                        ItemName = p.Notes,
                        Height = p.Height,
                        Depth = p.Depth,
                        Length = p.Length
                    })
                    .ToList()
                : j.BookingParent.TucJobBookingItems.Select(p => new ParcelDimensions
                    {
                        ItemId = p.ItemId,
                        ItemName = p.Notes,
                        Height = p.Height,
                        Depth = p.Depth,
                        Length = p.Length
                    })
                    .ToList(),

            Distance = j.ToAirportId.HasValue && j.FromAirportId.HasValue ?
                DistanceCalculator.CalculateDistance(
                    j.PickUpLatitude  ?? 0,
                    j.PickUpLongitude ?? 0,
                    j.DeliveryLatitude ?? 0,
                    j.DeliveryLongitude ?? 0) :  0, // ToDo: Add Kerran's new field

 // Added recurring job fields
            InActiveBy = j.UcbkInActiveBy != null
                ? new Suggestion { Id = j.UcbkInActiveBy.Value, Text = FormatFullName(j.UcbkInActiveByNavigation) }
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
            DaysOfWeek = (DaysOfWeek)j.UcbkDaysInt,
            Frequency = (Frequency)(j.UcbkFrequency ?? 0),
            HolidayDeliveryOption = (HolidayDeliveryOptions)j.HolidayDeliveryOption,

            PickUpWindowMins = j.PickUpWindowMins,
            DeliverByWindowMins = j.DeliverByWindowMins
        };

    public static readonly Expression<Func<TucJob, JobLateCallDto>> JobLateCallMapping =
        j => new JobLateCallDto
        {
            Id = j.UcjbId,
            ClientId = j.UcjbClientId ?? 0,
            MinutesRemaining = CalculateRemainTime(j, j.UcjbSpeedNavigation) ?? 0,
            PickupTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.PickupTime ?? 0 : 0,
            DeliveryTime = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.DeliveryTime ?? 0 : 0,
            AlertLatePickup = j.UcjbClient.AlertLatePickUp,
            AlertLateDelivery = j.UcjbClient.AlertLateDelivery,
            JobTime = CombineDateAndTime(j.UcjbDate, j.UcjbTime),
            BookedSpeed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : string.Empty,
            NotifiedSpeed = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName :
                j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : string.Empty
        };

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
        if (time is null) return date;

        return new DateTime(
            date.Year,
            date.Month,
            date.Day,
            time.Value.Hour,
            time.Value.Minute,
            time.Value.Second
        );
    }

    private static string FormatFullName(TucStaff staff) =>
        $"{staff.UcstFirstName} {staff.UcstLastName}".Trim();
}
