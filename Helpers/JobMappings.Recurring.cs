using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
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
            Barcode = j.Barcode ?? Defaults.NotAvailable,
            ConNote = j.Connote,

            PickupTime = null,
            DeliveryTime = null,

            Courier = null,
            CourierData = j.Courier != null
                ? new CourierData
                    { CourierId = j.Courier.UccrId, CourierNumber = j.Courier.Code, CourierName = j.Courier.UccrName }
                : null,
            AssignedCourier = j.Courier != null
                ? new Suggestion { Id = j.Courier.UccrId, Text = j.Courier.UccrName ?? Defaults.NotAvailable }
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
            TrackingEmail = j.TrackingEmail ?? Defaults.NotAvailable,

            // Delivery details
            PrivateRes = (j.DeliverToPrivateBusiness ?? 0) == 1,
            Return = j.UcbkReturn,
            SaturdayDelivery = j.SaturdayDelivery,
            DeliverToLeaveId = j.DeliverToLeaveId,
            DeliverToContact = j.DeliverToContact ?? Defaults.NotSpecified,

            // Location data
            PickUpLatitude = j.PickUpLatitude,
            PickUpLongitude = j.PickUpLongitude,
            DeliveryLatitude = j.DeliveryLatitude,
            DeliveryLongitude = j.DeliveryLongitude,

            // Client information
            Client = j.UcbkClientCode,
            ClientName = j.UcbkClient != null ? j.UcbkClient.UcclName : string.Empty,
            ToContactPhone = j.DeliverToPhone ?? Defaults.NotSpecified,

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
            Items = j.TucJobBookingItemBookings.Count,

            PickupFrom = j.UcbkPickUpFrom.HasValue ? (short)j.UcbkPickUpFrom : null,
            FromContactName = j.PickupFromContact ?? Defaults.NotApplicable,

            // Speed and job type information
            SpeedId = j.UcbkSpeed,
            NotifiedJobTypeId = j.NotifiedJobTypeId,
            AcceptedJobTypeId = j.AcceptedJobTypeId,

            // References and amounts
            RefA = j.UcbkClientRefa,
            RefB = j.UcbkClientRefb,
            OurRef = j.UcbkOurRef,

            // Pricing
            Charge = j.UcbkAmount ?? 0,

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

            // Distance - calculated during enrichment for flight jobs, otherwise use stored value
            Distance = (double)(j.TotalDistance ?? 0),

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
            // Recurring Route assignment. Drives the Route dropdown in
            // the React detail panel's JobDetailHeader so the current
            // selection pre-populates rather than reading "No route".
            RouteId = j.RouteId,

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
            CustomJobName = j.CustomJobName,
            RouteId = j.RouteId,
            RouteName = j.Route != null ? j.Route.Name : null,
            RecurringMode = (Enums.RecurringMode)j.RecurringMode,
            RawBaseAmount = j.RawBaseAmount,
            FuelSurchargeAmount = j.FuelSurchargeAmount,
            UcbkAmount = j.UcbkAmount,
            // BookingParentID = self (or NULL) means parent / standalone;
            // otherwise this row is a child in a family.
            IsChild = j.BookingParentId.HasValue && j.BookingParentId.Value != j.UcbkId
        };
}
