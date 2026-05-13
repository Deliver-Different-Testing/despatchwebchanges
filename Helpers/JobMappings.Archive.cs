using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
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
        CreatedDate = j.CreatedTimeUtc,
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
        Barcode = j.Barcode ?? Defaults.NotAvailable,

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
                    AgentName = j.Agent.UcagName ?? Defaults.NotAvailable,
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
        Items = j.TucJobItemsArchives.Count,

        PickupFrom = j.UcjbPickUpFrom,
        Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
        FromContactName = j.PickUpFromContact ?? Defaults.NotApplicable,
        FromContactNumber =
            j.PickUpFromPhone != null && j.PickUpFromPhone != ""
                ? j.PickUpFromPhone
                : j.Contact != null && j.Contact.UcctDirectDial != null && j.Contact.UcctDirectDial != ""
                    ? j.Contact.UcctDirectDial
                    : j.Contact != null && j.Contact.UcctMobile != null && j.Contact.UcctMobile != ""
                        ? j.Contact.UcctMobile
                        : j.UcjbClient != null && j.UcjbClient.UcclPhone != null && j.UcjbClient.UcclPhone != ""
                            ? j.UcjbClient.UcclPhone
                            : null,
        FromContactNumberSource =
            j.PickUpFromPhone != null && j.PickUpFromPhone != ""
                ? "Job"
                : j.Contact != null && j.Contact.UcctDirectDial != null && j.Contact.UcctDirectDial != ""
                    ? "Direct Line"
                    : j.Contact != null && j.Contact.UcctMobile != null && j.Contact.UcctMobile != ""
                        ? "Mobile"
                        : j.UcjbClient != null && j.UcjbClient.UcclPhone != null && j.UcjbClient.UcclPhone != ""
                            ? "Company"
                            : null,

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
        Charge = j.UcjbAmount ?? 0,

        StatusId = j.UcjbStatus,
        Status = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsCode : null,
        StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
        InternalStatusId = j.InternalStatus,
        ConNote = j.Parent != null ? j.Parent.Connote : j.Connote,

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

        // Distance - calculated during enrichment for flight jobs, otherwise use stored value
        Distance = (double)(j.TotalDistance ?? 0),

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
        IsPartnerJob = j.PartnerJobGuid.HasValue,

        // Job item flags - child stop items first, fall back to own (simple/parent) items
        TailLiftPu = j.TucJobItemsArchives.Any(i => i.Pu == true)
            || j.TucJobItemsArchiveJobs.Any(i => i.Pu == true),
        TailLiftDo = j.TucJobItemsArchives.Any(i => i.Do == true)
            || j.TucJobItemsArchiveJobs.Any(i => i.Do == true),
        DeliverToPrivateRes = j.TucJobItemsArchives.Any(i => i.PrivateRes == true)
            || j.TucJobItemsArchiveJobs.Any(i => i.PrivateRes == true),

        // Parcel dimensions - child stop items first, fall back to own (simple/parent) items
        ParcelDimensions = j.TucJobItemsArchives.Any()
            ? j.TucJobItemsArchives.Select(i => new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Weight = i.Weight,
                    Barcode = i.Barcode
                }).ToList()
            : j.TucJobItemsArchiveJobs.Any(i => i.ChildJobId == null)
                ? j.TucJobItemsArchiveJobs.Where(i => i.ChildJobId == null).Select(i => new ParcelDimensions
                {
                    ItemId = i.ItemId,
                    ItemName = i.Notes,
                    Height = i.Height,
                    Depth = i.Depth,
                    Length = i.Length,
                    Weight = i.Weight,
                    Barcode = i.Barcode
                }).ToList()
                : null,

        // Pallet info - child stop items first, fall back to own (simple/parent) items
        PalletInfo = j.TucJobItemsArchives.Any()
            ? j.TucJobItemsArchives.Select(i => new PalletInfo
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
            : j.TucJobItemsArchiveJobs.Any(i => i.ChildJobId == null)
                ? j.TucJobItemsArchiveJobs.Where(i => i.ChildJobId == null).Select(i => new PalletInfo
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

        CustomJobName = j.CustomJobName,

        // Arrival times
        PickupArrivalTime = j.PickupArrivalTime,
        DeliveryArrivalTime = j.DeliveryArrivalTime
    };

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
            IsPartnerJob = j.PartnerJobGuid.HasValue,

            ToAirportId = j.ToAirportId,
            FromAirportId = j.FromAirportId
        };
}
