using System;
using System.Collections.Generic;
using System.Linq;
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

        // Tail Lift - computed during enrichment for performance
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

        // Job status and details
        Done = j.Done,
        AlertLatePickup = j.Client != null ? j.Client.AlertLatePickUp : null,
        AlertLateDelivery = j.Client != null ? j.Client.AlertLateDelivery : null,
        Items = j.TblBulkJobItems.Count,

        FromContactName = j.PickupFromContact ?? Defaults.NotApplicable,
        FromContactNumber =
            (j.PickupFromPhone != null && j.PickupFromPhone != "")
                ? j.PickupFromPhone
                : (j.Client != null && j.Client.UcclPhone != null && j.Client.UcclPhone != "")
                    ? j.Client.UcclPhone
                    : null,
        FromContactNumberSource =
            (j.PickupFromPhone != null && j.PickupFromPhone != "")
                ? "Job"
                : (j.Client != null && j.Client.UcclPhone != null && j.Client.UcclPhone != "")
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

        ParcelDimensions = GetPackagesForBulkJob(j, j.Parent,
            j.TblBulkJobItems, j.Parent.TblBulkJobItems)
    };

    #region Bulk Job Helpers

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

    private static ParcelDimensions CreateParcelDimensions(TblBulkJobItem item) =>
        new()
        {
            ItemId = item.ItemId,
            ItemName = item.Notes,
            Height = item.Height,
            Depth = item.Depth,
            Length = item.Length,
            Barcode = item.Barcode
        };

    #endregion
}
