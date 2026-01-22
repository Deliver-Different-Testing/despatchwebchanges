using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Helpers;

public static class JobMappings
{
    private static readonly DateTime SqlMinDateTime = new(1753, 1, 1);

    public static readonly Expression<Func<TblBulkJob, JobViewModel>> BulkJobMapping = j => new JobViewModel
    {
        AngularId = Guid.NewGuid(),
        ClientId = j.ClientId,
        Id = j.BulkJobId,
        JobNo = j.JobNumber,
        Time = j.BookTime,
        ParentId = j.ParentId,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.BookDate),
        Booked = j.BookDate.CombineWithTime(j.BookTime),
        CreatedDate = j.BookDate,
        ScheduleName = j.ScheduleName,
        Void = j.Void,
        IsInvoiced = false,
        Barcode = j.Barcode ?? "-",

        LoggedInContactName = j.LoggedInContact != null
            ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
            : string.Empty,
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
                    CourierNumber = j.Courier.Code,
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
        TrackingEmail = j.TrackingEmail ?? "-",

        // Delivery details
        PrivateRes = j.DeliverToPrivateBusiness,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact ?? "Not specified",

        // Location data
        PickUpLatitude = decimal.Parse(j.PickUpLatitude),
        PickUpLongitude = decimal.Parse(j.PickUpLongitude),
        DeliveryLatitude = decimal.Parse(j.DeliveryLatitude),
        DeliveryLongitude = decimal.Parse(j.DeliveryLongitude),

        // Client information
        Client = j.ClientCode,
        ClientName = j.Client != null ? j.Client.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone ?? "Not specified",

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

        FromContactName = j.PickupFromContact ?? "N/A",
        FromContactNumber = j.PickupFromPhone ?? "Not specified",

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
            j.TblBulkJobItems, j.Parent.TblBulkJobItems)
    };

    public static readonly Expression<Func<TucJobArchive, JobViewModel>> JobArchiveMapping = j => new JobViewModel
    {
        AngularId = Guid.NewGuid(),
        ClientId = j.UcjbClientId,
        Id = j.UcjbId,
        JobNo = j.UcjbNumber,
        Time = j.UcjbTime,
        ParentId = j.ParentId,
        RootParentId = j.RootParentId,
        Date = FormatDate(j.UcjbDate),
        Booked = j.UcjbDate.HasValue
            ? j.UcjbDate.Value.CombineWithTime(j.UcjbTime)
            : SqlMinDateTime,
        DispatchTime = j.UcjbDispTime,
        CreatedDate = j.UcjbDate,
        ScheduleName = j.ScheduleName,
        FollowupTime = j.FollowupTime,
        Void = j.UcjbVoid,
        IsInvoiced = j.InvoiceProcess != null && j.InvoiceProcess.UcipDone,
        LoggedInContactName = j.LoggedInContact != null
            ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
            : string.Empty,
        BookingSource = j.Source != null
            ? new Suggestion { Id = j.Source.SourceId, Text = j.Source.Name }
            : null,
        Barcode = j.Barcode ?? "-",

        PickupTime = j.SpeedNavigation != null ? j.SpeedNavigation.PickupTime : null,
        DeliveryTime = j.SpeedNavigation != null ? j.SpeedNavigation.DeliveryTime : null,

        Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
        CourierData = j.UcjbCourier != null
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

        // Flight info - not loaded inline for archived jobs, use BatchLoadFlightInfo instead
        AssignedFlight = null,
        IsFlightAssigned = false,

        AssignedAgent =
            j.Agent != null
                ? new AgentViewModel
                {
                    AgentId = j.Agent.UcagId,
                    AgentName = j.Agent.UcagName ?? "-",
                    AgentEmail = j.Agent.UcagFax ?? "-",
                    AgentPhone = j.Agent.UcagPhone ?? "-"
                }
                : null,
        IsAgentAssigned = j.Agent != null,

        // Tracking info
        TrackingMethod = j.TrackingMethod,
        TrackingMobile = j.TrackingMobile,
        TrackingEmail = j.TrackingEmail ?? "-",

        // Delivery details
        PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
        Return = j.UcjbReturn,
        SaturdayDelivery = j.SaturdayDelivery,
        CompletedTime = j.UcjbComplTime,
        UdStatus = j.UndeliverableLocation != null ? j.UndeliverableLocation.Name : string.Empty,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact ?? "Not specified",

        // Location data
        PickUpLatitude = j.PickUpLatitude,
        PickUpLongitude = j.PickUpLongitude,
        DeliveryLatitude = j.DeliveryLatitude,
        DeliveryLongitude = j.DeliveryLongitude,

        // Client information
        Client = j.UcjbClientCode,
        ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone ?? "Not specified",
        PodName = j.UcjbPodname,
        PuTime = j.PickUpTime,
        AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : null,
        AlertLateDelivery = j.UcjbClient != null ? j.UcjbClient.AlertLateDelivery : null,

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
        Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
        FromContactName = j.PickUpFromContact ?? "N/A",
        FromContactNumber = j.PickUpFromPhone ?? "Not specified",

        // Speed and job type information
        Speed = j.SpeedNavigation != null ? j.SpeedNavigation.ShortName : null,
        SpeedName = j.SpeedNavigation != null ? j.SpeedNavigation.UcjtName : null,
        NotifiedName = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
        AcceptedName = j.AcceptedJobType != null ? j.AcceptedJobType.UcjtName : null,
        SpeedId = j.UcjbSpeed,
        NotifiedJobTypeId = j.NotifiedJobTypeId,
        AcceptedJobTypeId = j.AcceptedJobTypeId,

        // Flight job indicator - check for both US (2) and NZ (5) flight grouping IDs
        IsFlightJob = j.SpeedNavigation != null
                      && (j.SpeedNavigation.GroupingId == (int)SpeedGrouping.Flight
                          || j.SpeedNavigation.GroupingId == (int)UrgentSpeedGrouping.Flight),

        // Agent job indicator - check for both US (3) and NZ (6) agent grouping IDs
        IsAgentJob = j.SpeedNavigation != null
                     && (j.SpeedNavigation.GroupingId == (int)SpeedGrouping.Agent
                         || j.SpeedNavigation.GroupingId == (int)UrgentSpeedGrouping.NationwideAgent),

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
        Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
        StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
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

        Locked = j.UcjbLocked != null && j.UcjbLocked != 0,

        // Job item flags - loaded inline from navigation property
        TailLiftPu = j.TucJobItemsArchives.Any(i => i.Pu == true),
        TailLiftDo = j.TucJobItemsArchives.Any(i => i.Do == true),
        DeliverToPrivateRes = j.TucJobItemsArchives.Any(i => i.PrivateRes == true),

        // Parcel dimensions - from archived job items
        ParcelDimensions = j.TucJobItemsArchives.Any()
            ? j.TucJobItemsArchives.Where(i => i.ChildJobId == null || i.ChildJobId == j.UcjbId).Select(i =>
                new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Barcode = i.Barcode
                }).ToList()
            : null,

        // Pallet info - from archived job items
        PalletInfo = j.TucJobItemsArchives.Any(i => i.ChildJobId == null)
            ? j.TucJobItemsArchives.Where(i => i.ChildJobId == null).Select(i => new PalletInfo
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
            }).ToList()
            : null,

        CustomJobName = j.CustomJobName
    };

    public static readonly Expression<Func<TucJobBooking, JobViewModel>> JobRecurringMapping = j =>
        new JobRecurringViewModel
        {
            AngularId = Guid.NewGuid(),
            ClientId = j.UcbkClientId,
            Id = j.UcbkId,
            JobNo = j.UcbkJobNumber,
            CustomJobName = j.CustomJobName,
            ParentId = j.ParentId,
            Time = j.UcbkTime,
            RootParentId = j.RootParentId,
            Date = FormatDate(j.UcbkDate),
            Booked = j.UcbkDate.HasValue
                ? j.UcbkDate.Value.CombineWithTime(j.UcbkTime)
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
            Barcode = j.Barcode ?? "-",
            ConNote = j.Connote,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.Courier != null
                ? new CourierData
                    { CourierId = j.Courier.UccrId, CourierNumber = j.Courier.Code, CourierName = j.Courier.UccrName }
                : null,
            AssignedCourier = j.Courier != null
                ? new Suggestion { Id = j.Courier.UccrId, Text = j.Courier.UccrName ?? "-" }
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
            TrackingEmail = j.TrackingEmail ?? "-",

            // Delivery details
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            Return = j.UcbkReturn,
            SaturdayDelivery = j.SaturdayDelivery,
            DeliverToLeaveId = j.DeliverToLeaveId,
            DeliverToContact = j.DeliverToContact ?? "Not specified",

            // Location data
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            // Client information
            Client = j.UcbkClientCode,
            ClientName = j.UcbkClient != null ? j.UcbkClient.UcclName : string.Empty,
            ToContactPhone = j.DeliverToPhone ?? "Not specified",

            // Job characteristics
            Weight = j.UcbkWeight,
            Speed = j.UcbkSpeedNavigation != null ? j.UcbkSpeedNavigation.UcjtName : null,
            SpeedName = j.UcbkSpeedNavigation != null ? j.UcbkSpeedNavigation.UcjtName : null,
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
            FromContactName = j.PickupFromContact ?? "N/A",

            // Speed and job type information
            SpeedId = j.UcbkSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcbkClientRefa,
            RefB = j.UcbkClientRefb,
            OurRef = j.UcbkOurRef,

            // Pricing
            Charge = j.BookingParent != null && j.BookingParent.PricingBreakdownPrebookJobs != null
                ? j.BookingParent.PricingBreakdownPrebookJobs.Sum(p => p.ChargeAmount)
                : j.PricingBreakdownPrebookJobs != null
                    ? j.PricingBreakdownPrebookJobs.Sum(p => p.ChargeAmount)
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
            JobTime = j.UcjbDate.CombineWithTime(j.UcjbTime),
            BookedSpeed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : string.Empty,
            NotifiedSpeed = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName
                : j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName
                : string.Empty
        };

    public static readonly Expression<Func<TucJobBooking, PrebookListViewModel>> ToPrebookListViewModel = j =>
        new PrebookListViewModel
        {
            Id = j.UcbkId,
            Booked = j.UcbkDate.HasValue && j.UcbkTime.HasValue
                ? j.UcbkDate.Value.CombineWithTime(j.UcbkTime)
                : SqlMinDateTime,
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
            Booked = j.UcjbDate.CombineWithTime(j.UcjbTime),
            IsFlightJob = j.UcjbSpeedNavigation != null
                          && j.UcjbSpeedNavigation.GroupingId ==
                          (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
            IsAgentJob = j.UcjbSpeedNavigation != null
                         && j.UcjbSpeedNavigation.GroupingId !=
                         (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),

            Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
            CourierData =
                j.UcjbCourier != null
                    ? new CourierData
                    {
                        Courier = j.UcjbCourier.Code ?? "-",
                        CourierNumber = j.UcjbCourier.Code ?? "-",
                        CourierId = j.UcjbCourierId,
                        CourierMobile = j.UcjbCourier.UccrMobile ?? "-",
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
                AddressLine5 = j.PickupAddressLine5 ?? "-",
                AddressLine6 = j.PickupAddressLine6,
                AddressLine7 = j.PickupAddressLine7,
                AddressLine8 = j.PickupAddressLine8,
                Latitude = j.PickUpLatitude,
                Longitude = j.PickUpLongitude
            },
            DeliveryAddress = new AddressViewModel
            {
                AddressLine1 = j.DeliveryAddressLine1 ?? "-",
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
            DeliveryContact = j.DeliverToContact ?? "Not specified",

            Direct = j.Direct,
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : "-",
            Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
            Vehicle =
                j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName ?? "-"
                    }
                    : null,

            Client = j.UcjbClientCode ?? "-",
            ClientId = j.UcjbClientId,
            ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : "-",

            JobType = (int)(j.UcjbType ?? 0),
            PickupTime = null,
            DeliveryTime = null,
            AlertLatePickup = j.UcjbClient != null ? j.UcjbClient.AlertLatePickUp : null,

            Lp = j.UcjbLatePick,
            Ld = j.UcjbLateDel,

            Done = j.UcjbJobDone,
            PreBook = true,
            IsArchived = false,

            PickupFrom = j.UcjbPickUpFrom,
            RootParentId = j.RootParentId,

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId,

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
            IsAgentAssigned = j.Agent != null,

            Locked = j.UcjbLocked ?? false,

            ConNote = j.Parent != null ? j.Parent.Connote : j.Connote,
            FollowupTime = j.FollowupTime,
            Van = j.UcjbVan,
            Truck = j.Truck ?? false,
            DgClass = j.Dgclass,

            AllowSplit = !j.ParentId.HasValue || j.ParentId != j.UcjbId,

            PickUpTimeZone = j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
            DeliveryTimeZone = j.DeliverByTimeZone != null
                ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                : null,
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
        DispatchTime = j.UcjbDispTime,
        CreatedDate = j.UcjbDate,
        ScheduleName = j.ScheduleName ?? "-",
        FollowupTime = j.FollowupTime,
        Void = j.UcjbVoid,
        IsInvoiced = false,
        Barcode = j.Barcode ?? "-",

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
                AgentName = j.Agent.UcagName ?? "-",
                AgentRanking = j.Agent.Ranking != null ? j.Agent.Ranking.AgentRankingName : "-",
                AgentEmail = j.Agent.UcagFax ?? "-",
                AgentPhone = j.Agent.UcagPhone ?? "-"
            }
            : null,
        IsAgentAssigned = j.Agent != null,

        // Tracking info
        TrackingMethod = j.TrackingMethod,
        TrackingMobile = j.TrackingMobile,
        TrackingEmail = j.TrackingEmail ?? "-",

        // Delivery details
        PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
        Return = j.UcjbReturn,
        SaturdayDelivery = j.SaturdayDelivery,
        CompletedTime = j.UcjbComplTime,
        UdStatus = j.UndeliverableLocation != null ? j.UndeliverableLocation.Name : string.Empty,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact ?? "Not specified",

        // Location data
        PickUpLatitude = j.PickUpLatitude,
        PickUpLongitude = j.PickUpLongitude,
        DeliveryLatitude = j.DeliveryLatitude,
        DeliveryLongitude = j.DeliveryLongitude,

        // Client information
        Client = j.UcjbClientCode,
        ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone ?? "Not specified",
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
        FromContactNumber = j.PickupFromPhone ?? "Not specified",

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

        // Charge - use pricing breakdown sum if available, otherwise fall back to base amount
        Charge = j.PricingBreakdownJobs.Any()
            ? j.PricingBreakdownJobs.Sum(p => p.ChargeAmount)
            : j.UcjbAmount,

        // Status
        StatusId = j.UcjbStatus,
        Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
        StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
        InternalStatusId = j.InternalStatus,
        ConNote = j.Connote,

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

        Distance = j.ToAirportId != null && j.FromAirportId != null
            ? DistanceCalculator.CalculateDistance(
                j.PickUpLatitude ?? 0,
                j.PickUpLongitude ?? 0,
                j.DeliveryLatitude ?? 0,
                j.DeliveryLongitude ?? 0
            )
            : (double)(j.TotalDistance ?? 0),

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

        // Job item flags - loaded inline from navigation property
        TailLiftPu = j.TucJobItemJobs.Any(i => i.Pu == true),
        TailLiftDo = j.TucJobItemJobs.Any(i => i.Do == true),
        DeliverToPrivateRes = j.TucJobItemJobs.Any(i => i.PrivateRes == true),

        // Parcel dimensions - try child items first, then parent items
        ParcelDimensions = j.TucJobItemChildJobs.Any()
            ? j.TucJobItemChildJobs.Select(i => new ParcelDimensions
            {
                ItemId = i.ItemId,
                ItemName = i.Notes,
                Height = i.Height,
                Depth = i.Depth,
                Length = i.Length,
                Barcode = i.Barcode
            }).ToList()
            : j.TucJobItemJobs.Where(i => i.ChildJobId == null).Select(i => new ParcelDimensions
            {
                ItemId = i.ItemId,
                ItemName = i.Notes,
                Height = i.Height,
                Depth = i.Depth,
                Length = i.Length,
                Barcode = i.Barcode
            }).ToList(),

        // Pallet info - from parent job items only

        PalletInfo = j.TucJobItemJobs.Any(i => i.ChildJobId == null)
            ? j.TucJobItemJobs.Where(i => i.ChildJobId == null).Select(i => new PalletInfo
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
            }).ToList()
            : null,

        // Flight info - loaded inline for root jobs, batch loaded for child jobs
        // Use SelectMany to get first and last segments in single subqueries
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
                            : null,
                        ExpectedArrival = last.UcnwEta,
                        ArrivalTimeZone = last.ArrivalAirportTimeZoneNavigation != null
                            ? last.ArrivalAirportTimeZoneNavigation.Name
                            : null,
                        FlightNumber = first.UcnwFlightNo ?? "",
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
                                    : null,
                                DepartureAirportTimeZoneId = n.DepartureAirportTimeZoneId ?? 0,
                                DepartureTerminal = n.DepartureTerminal,
                                ArrivalAirportFsCode = n.ArrivalAirportFsCode,
                                ArrivalAirportName = n.ArrivalAirportName,
                                ArrivalAirportCity = n.ArrivalAirportCity,
                                ArrivalAirportCountry = n.ArrivalAirportCountry,
                                ArrivalAirportTimeZone = n.ArrivalAirportTimeZoneNavigation != null
                                    ? n.ArrivalAirportTimeZoneNavigation.Name
                                    : null,
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
    };

    private static string FormatDate(DateTime? date)
    {
        var dateToUse = date ?? SqlMinDateTime;
        return dateToUse.ToString("MM/dd/yyyy");
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

    private static List<ParcelDimensions> GetPackagesForBulkJob(
        TblBulkJob job,
        TblBulkJob parent,
        ICollection<TblBulkJobItem> jobItems,
        ICollection<TblBulkJobItem> parentJobItems)
    {
        // Priority 1: Job items if this is a root job or self-referencing job
        if ((parent == null || job.ParentId == job.BulkJobId) && HasItems(jobItems))
            return ConvertToParcelDimensions(jobItems);

        // Priority 2: Parent items as fallback
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
            Length = item.Length,
            Barcode = item.Barcode
        };
    }

    public static Expression<Func<TucJob, DispatchJobViewModel>> PodSearchMapping(bool isUsCustomer) =>
        j => new DispatchJobViewModel
        {
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            HasBeenRead = j.TucJobReadTracker != null && j.TucJobReadTracker.HasBeenRead,
            IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.UcjbId,
            ParentId = j.ParentId,

            IsFlightJob = j.UcjbSpeedNavigation != null
                          && j.UcjbSpeedNavigation.GroupingId ==
                          (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
            IsAgentJob = j.UcjbSpeedNavigation != null
                         && j.UcjbSpeedNavigation.GroupingId ==
                         (isUsCustomer ? (int)SpeedGrouping.Agent : (int)UrgentSpeedGrouping.NationwideAgent),

            Vehicle = j.UcjbSizeNavigation != null
                ? new Suggestion
                {
                    Id = j.UcjbSizeNavigation.VehicleSizeId,
                    Text = j.UcjbSizeNavigation.VehicleName
                }
                : null,

            Time = j.UcjbTime,
            ClientId = j.UcjbClientId,
            Client = j.UcjbClientCode,
            ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,

            From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
            ToSuburbId = j.UcjbTo,
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

            Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
            CourierData = j.UcjbCourier != null
                ? new CourierData
                {
                    Courier = j.UcjbCourier.Code,
                    CourierNumber = j.UcjbCourier.Code,
                    CourierId = j.UcjbCourier.UccrId,
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

            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : null,
            SpeedId = j.UcjbSpeed,
            JobTypeMins = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.Minutes : null,

            PreBook = false,
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            Booked = j.UcjbDate.CombineWithTime(j.UcjbTime),
            IsArchived = false,
            Locked = j.UcjbLocked ?? false,

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId
        };

// Add archived version too
    public static Expression<Func<TucJobArchive, DispatchJobViewModel>> PodSearchArchivedMapping(bool isUsCustomer) =>
        j => new DispatchJobViewModel
        {
            Id = j.UcjbId,
            JobNo = j.UcjbNumber,
            HasBeenRead = false, // Archived jobs don't track reads
            IsParentOrSingle = !j.ParentId.HasValue || j.ParentId == j.UcjbId,
            ParentId = j.ParentId,

            IsFlightJob = j.SpeedNavigation != null
                          && j.SpeedNavigation.GroupingId ==
                          (isUsCustomer ? (int)SpeedGrouping.Flight : (int)UrgentSpeedGrouping.Flight),
            IsAgentJob = j.SpeedNavigation != null
                         && j.SpeedNavigation.GroupingId ==
                         (isUsCustomer ? (int)SpeedGrouping.Agent : (int)UrgentSpeedGrouping.NationwideAgent),

            Vehicle = j.UcjbSizeNavigation != null
                ? new Suggestion
                {
                    Id = j.UcjbSizeNavigation.VehicleSizeId,
                    Text = j.UcjbSizeNavigation.VehicleName
                }
                : null,

            Time = j.UcjbTime,
            ClientId = j.UcjbClientId,
            Client = j.UcjbClientCode,
            ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : string.Empty,

            From = j.UcjbFromNavigation != null ? j.UcjbFromNavigation.UcsuName : null,
            ToSuburbId = j.UcjbTo,
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

            Courier = j.UcjbCourier != null ? j.UcjbCourier.Code : null,
            CourierData = j.UcjbCourier != null
                ? new CourierData
                {
                    Courier = j.UcjbCourier.Code,
                    CourierNumber = j.UcjbCourier.Code,
                    CourierId = j.UcjbCourier.UccrId,
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

            StatusId = j.UcjbStatus,
            Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            Speed = j.SpeedNavigation != null ? j.SpeedNavigation.ShortName : null,
            SpeedId = j.UcjbSpeed,
            JobTypeMins = j.SpeedNavigation != null ? j.SpeedNavigation.Minutes : null,

            PreBook = false,
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            Booked = j.UcjbDate.HasValue
                ? j.UcjbDate.Value.CombineWithTime(j.UcjbTime)
                : DateTime.MinValue,
            IsArchived = true,
            Locked = j.UcjbLocked.HasValue && j.UcjbLocked != 0,

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId
        };

    #region POD Search Download Mappings

    /// <summary>
    /// Projects TucJob (live jobs) directly to JobDownloadModel.
    /// Amount uses parent pricing breakdown sum if available, else job's own sum, else UcjbAmount.
    /// Matches the calculation logic used in JobArchiveMapping for consistency.
    /// </summary>
    public static readonly Expression<Func<TucJob, JobDownloadModel>> LiveJobDownloadMapping =
        j => new JobDownloadModel
        {
            Id = j.UcjbId,
            ParentId = j.ParentId,
            JobNumber = j.UcjbNumber,
            CustomerName = j.UcjbClient != null ? j.UcjbClient.UcclName : null,
            BookDate = j.UcjbDate.CombineWithTime(j.UcjbTime),
            PickedUpDate = j.PickUpTime,
            DeliveredDate = j.UcjbComplTime,
            Amount = j.Parent != null && j.Parent.PricingBreakdownJobs.Any()
                ? j.Parent.PricingBreakdownJobs.Sum(pb => pb.ChargeAmount)
                : j.PricingBreakdownJobs.Any()
                    ? j.PricingBreakdownJobs.Sum(pb => pb.ChargeAmount)
                    : j.UcjbAmount ?? 0,
            Fuel = j.FuelSurchargeAmount,
            Ppd = j.PpdexclusiveAmount,
            AgentAirlineName = j.TucJobNationwides.Select(nw => nw.UcnwAirlineName).FirstOrDefault()
                               ?? (j.Agent != null ? j.Agent.UcagName : null),
            AWB = j.TucJobNationwides.Select(nw => nw.UcnwFlightNo).FirstOrDefault(),
            CourierPayment = j.CourierPayment,
            CourierFuel = j.CourierFuel,
            CourierBonus = j.CourierBonus,
            Quantity = j.UcjbQty,
            Weight = j.UcjbWeight,
            Size = j.UcjbSize,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            PickupAddressLine1 = j.PickupAddressLine1,
            PickupAddressLine2 = j.PickupAddressLine2,
            PickupAddressLine3 = j.PickupAddressLine3,
            PickupAddressLine4 = j.PickupAddressLine4,
            PickupAddressLine5 = j.PickupAddressLine5,
            PickupAddressLine6 = j.PickupAddressLine6,
            PickupAddressLine7 = j.PickupAddressLine7,
            PickupAddressLine8 = j.PickupAddressLine8,
            DeliveryAddressLine1 = j.DeliveryAddressLine1,
            DeliveryAddressLine2 = j.DeliveryAddressLine2,
            DeliveryAddressLine3 = j.DeliveryAddressLine3,
            DeliveryAddressLine4 = j.DeliveryAddressLine4,
            DeliveryAddressLine5 = j.DeliveryAddressLine5,
            DeliveryAddressLine6 = j.DeliveryAddressLine6,
            DeliveryAddressLine7 = j.DeliveryAddressLine7,
            DeliveryAddressLine8 = j.DeliveryAddressLine8,
            ClientReferenceA = j.UcjbClientRefa,
            ClientReferenceB = j.UcjbClientRefb,
            ClientReferenceC = j.UcjbClientRefc,
            InvoiceNumber = null,
            InvoiceDate = null,
            IsArchived = false,
            LoggedInContact = j.LoggedInContact != null
                ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
                : null,
            RawBaseAmount = j.RawBaseAmount,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null
        };

    /// <summary>
    /// Projects TucJobArchive (archived jobs) directly to JobDownloadModel.
    /// Amount uses parent pricing breakdown sum if available, else job's own sum, else UcjbAmount.
    /// Matches the calculation logic used in JobArchiveMapping for consistency.
    /// </summary>
    public static readonly Expression<Func<TucJobArchive, JobDownloadModel>> ArchivedJobDownloadMapping =
        j => new JobDownloadModel
        {
            Id = j.UcjbId,
            ParentId = j.ParentId,
            JobNumber = j.UcjbNumber,
            CustomerName = j.UcjbClient != null ? j.UcjbClient.UcclName : null,
            BookDate = j.UcjbDate.HasValue ? j.UcjbDate.Value.CombineWithTime(j.UcjbTime) : default,
            PickedUpDate = j.PickUpTime,
            DeliveredDate = j.UcjbComplTime,
            Amount = j.Parent != null && j.Parent.PricingBreakdowns.Any()
                ? j.Parent.PricingBreakdowns.Sum(pb => pb.ChargeAmount)
                : j.PricingBreakdowns.Any()
                    ? j.PricingBreakdowns.Sum(pb => pb.ChargeAmount)
                    : j.UcjbAmount ?? 0,
            Fuel = j.FuelSurchargeAmount,
            Ppd = j.PpdexclusiveAmount,
            AgentAirlineName = j.Agent != null ? j.Agent.UcagName : null,
            AWB = null,
            CourierPayment = j.CourierPayment,
            CourierFuel = j.CourierFuel,
            CourierBonus = j.CourierBonus,
            Quantity = j.UcjbQty,
            Weight = j.UcjbWeight,
            Size = j.UcjbSize,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            PickupAddressLine1 = j.PickupAddressLine1,
            PickupAddressLine2 = j.PickupAddressLine2,
            PickupAddressLine3 = j.PickupAddressLine3,
            PickupAddressLine4 = j.PickupAddressLine4,
            PickupAddressLine5 = j.PickupAddressLine5,
            PickupAddressLine6 = j.PickupAddressLine6,
            PickupAddressLine7 = j.PickupAddressLine7,
            PickupAddressLine8 = j.PickupAddressLine8,
            DeliveryAddressLine1 = j.DeliveryAddressLine1,
            DeliveryAddressLine2 = j.DeliveryAddressLine2,
            DeliveryAddressLine3 = j.DeliveryAddressLine3,
            DeliveryAddressLine4 = j.DeliveryAddressLine4,
            DeliveryAddressLine5 = j.DeliveryAddressLine5,
            DeliveryAddressLine6 = j.DeliveryAddressLine6,
            DeliveryAddressLine7 = j.DeliveryAddressLine7,
            DeliveryAddressLine8 = j.DeliveryAddressLine8,
            ClientReferenceA = j.UcjbClientRefa,
            ClientReferenceB = j.UcjbClientRefb,
            ClientReferenceC = j.UcjbClientRefc,
            InvoiceNumber = j.UcjbInvoiceNo,
            InvoiceDate = j.Invoice != null ? j.Invoice.Created : null,
            IsArchived = true,
            LoggedInContact = j.LoggedInContact != null
                ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
                : null,
            RawBaseAmount = j.RawBaseAmount,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null
        };

    #endregion

    #region Job Enrichment Methods

    /// <summary>
    /// Enriches live jobs with collections (flight info for child jobs only).
    /// Pricing, parcels, and flags are now loaded inline via navigation properties.
    /// </summary>
    public static async Task EnrichJobsWithCollectionsAsync(
        List<JobViewModel> jobs,
        IDbContextFactory<DespatchContext> contextFactory,
        ITenantInfoService infoService)
    {
        if (jobs.Count == 0) return;

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);

        ApplyTimezoneToJobDates(jobs, infoService.GetTenantTimeZone());
    }

    /// <summary>
    /// Enriches archived jobs with collections (flight info for child jobs only).
    /// Pricing, parcels, and flags are now loaded inline via navigation properties.
    /// </summary>
    public static async Task EnrichArchivedJobsWithCollectionsAsync(
        List<JobViewModel> jobs,
        IDbContextFactory<DespatchContext> contextFactory,
        ITenantInfoService infoService)
    {
        if (jobs.Count == 0) return;

        // Only flight info needs batch loading for child jobs that inherit from parents
        await using var flightContext = await contextFactory.CreateDbContextAsync();
        await BatchLoadFlightInfoAsync(flightContext, jobs);

        ApplyTimezoneToJobDates(jobs, infoService.GetTenantTimeZone());
    }

    private static void ApplyTimezoneToJobDates(List<JobViewModel> jobs, string tenantTimeZone)
    {
        foreach (var job in jobs)
        {
            if (job.DispatchTime.HasValue)
                job.DispatchTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DispatchTime.Value, tenantTimeZone);

            if (job.PuTime.HasValue)
                job.PuTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.PuTime.Value, tenantTimeZone);

            if (job.FollowupTime.HasValue)
                job.FollowupTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.FollowupTime.Value, tenantTimeZone);

            if (job.CompletedTime.HasValue)
                job.CompletedTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.CompletedTime.Value, tenantTimeZone);

            if (job.CreatedDate.HasValue)
                job.CreatedDate = TimeZoneHelper.SetDateTimeWithTimeZone(job.CreatedDate.Value, tenantTimeZone);

            if (job.DeliverByTime.HasValue)
                job.DeliverByTime = TimeZoneHelper.SetDateTimeWithTimeZone(job.DeliverByTime.Value, tenantTimeZone);
        }
    }

    private static async Task BatchLoadFlightInfoAsync(
        DespatchContext context,
        List<JobViewModel> jobs)
    {
        // Process flight jobs that don't have flight info loaded yet
        // - For live jobs: child jobs that inherit from parents (root jobs loaded inline)
        // - For archived jobs: all flight jobs (no inline mapping available)
        var flightJobsNeedingData = jobs
            .Where(j => j.IsFlightJob && !j.IsFlightAssigned)
            .ToList();
        if (flightJobsNeedingData.Count == 0) return;

        // Get effective job IDs (use ParentId for child jobs, own I'd for root/archived jobs)
        var effectiveJobIds = flightJobsNeedingData
            .Select(j => j.ParentId ?? j.Id)
            .Distinct()
            .ToList();

        // Query TucJobNationwide directly by job ID - works for both live and archived jobs
        var segmentsByJob = await context.TucJobNationwides
            .AsNoTracking()
            .Where(n => n.UcnwJobId.HasValue && effectiveJobIds.Contains(n.UcnwJobId.Value))
            .Include(n => n.DepartureAirportTimeZoneNavigation)
            .Include(n => n.ArrivalAirportTimeZoneNavigation)
            .OrderBy(n => n.UcnwJobId)
            .ThenBy(n => n.UcnwLegNumber)
            .TagWith("BatchLoadFlightInfo - Flight Segments")
            .ToListAsync();

        var segmentsGroupedByJob = segmentsByJob
            .GroupBy(n => n.UcnwJobId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var job in flightJobsNeedingData)
        {
            var effectiveJobId = job.ParentId ?? job.Id;
            if (!segmentsGroupedByJob.TryGetValue(effectiveJobId, out var segments) || segments.Count == 0)
                continue;

            var flightSegments = segments.Select(segment => new FlightSegmentViewModel
            {
                SegmentOrder = segment.UcnwLegNumber - 1,
                CarrierFsCode = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length >= 2
                    ? segment.UcnwFlightNo[..2]
                    : "??",
                FlightNumber = !string.IsNullOrEmpty(segment.UcnwFlightNo) && segment.UcnwFlightNo.Length > 2
                    ? segment.UcnwFlightNo[2..]
                    : "????",
                DepartureTime = segment.UcnwEtd ?? SqlMinDateTime,
                ArrivalTime = segment.UcnwEta ?? SqlMinDateTime,
                DepartureAirportFsCode = segment.DepartureAirportFsCode,
                DepartureAirportName = segment.DepartureAirportName,
                DepartureAirportCity = segment.DepartureAirportCity,
                DepartureAirportCountry = segment.DepartureAirportCountry,
                DepartureAirportTimeZone = segment.DepartureAirportTimeZoneNavigation?.Name,
                DepartureAirportTimeZoneId = segment.DepartureAirportTimeZoneId ?? 0,
                DepartureTerminal = segment.DepartureTerminal,
                ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                ArrivalAirportName = segment.ArrivalAirportName,
                ArrivalAirportCity = segment.ArrivalAirportCity,
                ArrivalAirportCountry = segment.ArrivalAirportCountry,
                ArrivalAirportTimeZone = segment.ArrivalAirportTimeZoneNavigation?.Name,
                ArrivalAirportTimeZoneId = segment.ArrivalAirportTimeZoneId ?? 0,
                ArrivalTerminal = segment.ArrivalTerminal,
                ElapsedTime = (int)(segment.UcnwEta.HasValue && segment.UcnwEtd.HasValue
                    ? (segment.UcnwEta.Value - segment.UcnwEtd.Value).TotalMinutes
                    : 0),
                AircraftName = segment.AircraftName,
                AirlineName = segment.UcnwAirlineName
            }).ToList();

            var firstSegment = flightSegments[0];
            var lastSegment = flightSegments[^1];
            var notes = segments[0].UcnwNotes;

            job.AssignedFlight = new AssignedFlight
            {
                ExpectedArrival = lastSegment.ArrivalTime,
                ArrivalTimeZone = lastSegment.ArrivalAirportTimeZone,
                ExpectedDeparture = firstSegment.DepartureTime,
                DepartureTimeZone = firstSegment.DepartureAirportTimeZone,
                FlightNumber = firstSegment.CarrierFsCode + firstSegment.FlightNumber,
                Notes = notes,
                FlightSegments = flightSegments
            };
            job.IsFlightAssigned = true;

            ApplyFlightTimezones(job);
        }
    }

    private static void ApplyFlightTimezones(JobViewModel job)
    {
        if (job.AssignedFlight == null || job.AssignedFlight.FlightSegments.Count == 0)
            return;

        job.AssignedFlight.ExpectedArrival = job.AssignedFlight.ExpectedArrival.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(job.AssignedFlight.ExpectedArrival.Value,
                job.AssignedFlight.ArrivalTimeZone)
            : null;

        job.AssignedFlight.ExpectedDeparture = job.AssignedFlight.ExpectedDeparture.HasValue
            ? TimeZoneHelper.SetDateTimeWithTimeZone(job.AssignedFlight.ExpectedDeparture.Value,
                job.AssignedFlight.DepartureTimeZone)
            : null;

        foreach (var segment in job.AssignedFlight.FlightSegments)
        {
            segment.ArrivalTime =
                TimeZoneHelper.SetDateTimeWithTimeZone(segment.ArrivalTime, segment.ArrivalAirportTimeZone);
            segment.DepartureTime =
                TimeZoneHelper.SetDateTimeWithTimeZone(segment.DepartureTime, segment.DepartureAirportTimeZone);
        }
    }

    #endregion
}