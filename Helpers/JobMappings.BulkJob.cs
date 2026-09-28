using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
    public static readonly Expression<Func<TblBulkJob, JobViewModel>> BulkJobMapping = j => new JobViewModel
    {
        AngularId = Guid.NewGuid(),
        ClientId = j.ClientId,
        Id = j.BulkJobId,
        LinkedJobId = j.JobId,
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
        Barcode = j.Barcode ?? Defaults.NotAvailable,

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

        // Job item flags - loaded inline from navigation property (3-tier: stop child → own → parent)
        TailLiftPu = j.TblBulkJobItemChildJobs.Any(i => i.Pu == true)
            || j.TblBulkJobItemJobs.Any(i => i.Pu == true)
            || (j.Parent != null && j.Parent.TblBulkJobItemJobs.Any(i => i.ChildJobId == null && i.Pu == true)),
        TailLiftDo = j.TblBulkJobItemChildJobs.Any(i => i.Do == true)
            || j.TblBulkJobItemJobs.Any(i => i.Do == true)
            || (j.Parent != null && j.Parent.TblBulkJobItemJobs.Any(i => i.ChildJobId == null && i.Do == true)),
        DeliverToPrivateRes = j.TblBulkJobItemChildJobs.Any(i => i.PrivateRes == true)
            || j.TblBulkJobItemJobs.Any(i => i.PrivateRes == true)
            || (j.Parent != null && j.Parent.TblBulkJobItemJobs.Any(i => i.ChildJobId == null && i.PrivateRes == true)),

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
        TrackingEmail = j.TrackingEmail ?? Defaults.NotAvailable,

        // Delivery details
        PrivateRes = j.DeliverToPrivateBusiness,
        SigNotRequired = j.DeliverToLeave != null ? j.DeliverToLeave.Name : string.Empty,
        DeliverToLeaveId = j.DeliverToLeaveId,
        DeliverToContact = j.DeliverToContact ?? Defaults.NotSpecified,

        // Location data
        PickUpLatitude = decimal.Parse(j.PickUpLatitude),
        PickUpLongitude = decimal.Parse(j.PickUpLongitude),
        DeliveryLatitude = decimal.Parse(j.DeliveryLatitude),
        DeliveryLongitude = decimal.Parse(j.DeliveryLongitude),

        // Client information
        Client = j.ClientCode,
        ClientName = j.Client != null ? j.Client.UcclName : string.Empty,
        ToContactPhone = j.DeliverToPhone ?? Defaults.NotSpecified,

        // Job characteristics
        Weight = j.Weight.HasValue ? (double)j.Weight : null,
        ToAddress = j.ToAddress,
        JobType = j.JobRelationshipTypeId ?? 0,
        JobTypeDescription = GetJobTypeDescription(j.JobRelationshipTypeId ?? 0),

        // Job status and details.
        // tblBulkJob.Done records that the row has been pushed to live dispatch, so it maps to
        // Released. Delivery is the live job's to report — mapping Done straight across made a
        // released bulk row render as delivered on every surface that reads Done.
        Released = j.Done,
        Done = j.Job != null && j.Job.UcjbJobDone,
        CompletedTime = j.Job != null ? j.Job.UcjbComplTime : null,
        AlertLatePickup = j.Client != null ? j.Client.AlertLatePickUp : null,
        AlertLateDelivery = j.Client != null ? j.Client.AlertLateDelivery : null,
        Items = j.TblBulkJobItemChildJobs.Any()
            ? j.TblBulkJobItemChildJobs.Count
            : j.TblBulkJobItemJobs.Count > 0
                ? j.TblBulkJobItemJobs.Count
                : j.Parent != null
                    ? j.Parent.TblBulkJobItemJobs.Count(i => i.ChildJobId == null)
                    : 0,

        FromContactName = j.PickupFromContact ?? Defaults.NotApplicable,
        FromContactNumber =
            j.PickupFromPhone != null && j.PickupFromPhone != ""
                ? j.PickupFromPhone
                : j.Client != null && j.Client.UcclPhone != null && j.Client.UcclPhone != ""
                    ? j.Client.UcclPhone
                    : null,
        FromContactNumberSource =
            j.PickupFromPhone != null && j.PickupFromPhone != ""
                ? "Job"
                : j.Client != null && j.Client.UcclPhone != null && j.Client.UcclPhone != ""
                    ? "Company"
                    : null,

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

        // Parcel dimensions - 3-tier: stop child items → own items → parent items
        ParcelDimensions = j.TblBulkJobItemChildJobs.Any()
            ? j.TblBulkJobItemChildJobs.Select(i => new ParcelDimensions
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
            : j.TblBulkJobItemJobs.Any(i => i.ChildJobId == null)
                ? j.TblBulkJobItemJobs.Where(i => i.ChildJobId == null).Select(i => new ParcelDimensions
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
                    ? j.Parent.TblBulkJobItemJobs.Where(i => i.ChildJobId == null)
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
                    : new List<ParcelDimensions>()
    };
}
