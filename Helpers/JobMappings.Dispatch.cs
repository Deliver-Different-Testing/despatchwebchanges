using System;
using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
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
                        Courier = j.UcjbCourier.Code ?? Defaults.NotAvailable,
                        CourierNumber = j.UcjbCourier.Code ?? Defaults.NotAvailable,
                        CourierId = j.UcjbCourierId,
                        CourierMobile = j.UcjbCourier.UccrMobile ?? Defaults.NotAvailable,
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
                AddressLine5 = j.PickupAddressLine5 ?? Defaults.NotAvailable,
                AddressLine6 = j.PickupAddressLine6,
                AddressLine7 = j.PickupAddressLine7,
                AddressLine8 = j.PickupAddressLine8,
                Latitude = j.PickUpLatitude,
                Longitude = j.PickUpLongitude
            },
            DeliveryAddress = new AddressViewModel
            {
                AddressLine1 = j.DeliveryAddressLine1 ?? Defaults.NotAvailable,
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
            DeliveryContact = j.DeliverToContact ?? Defaults.NotSpecified,

            Direct = j.Direct,
            Speed = j.UcjbSpeedNavigation != null ? j.UcjbSpeedNavigation.ShortName : Defaults.NotAvailable,
            Notify = j.NotifiedJobType != null ? j.NotifiedJobType.UcjtName : null,
            Vehicle =
                j.UcjbSizeNavigation != null
                    ? new Suggestion
                    {
                        Id = j.UcjbSizeNavigation.VehicleSizeId,
                        Text = j.UcjbSizeNavigation.VehicleName ?? Defaults.NotAvailable
                    }
                    : null,

            Client = j.UcjbClientCode ?? Defaults.NotAvailable,
            ClientId = j.UcjbClientId,
            ClientName = j.UcjbClient != null ? j.UcjbClient.UcclName : Defaults.NotAvailable,

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

            AllowSplit = !j.ParentId.HasValue || j.ParentId == j.UcjbId,

            PickUpTimeZone = j.PickupTimeZone != null
                ? new Suggestion { Id = j.PickupTimeZone.Id, Text = j.PickupTimeZone.Name }
                : null,
            DeliveryTimeZone = j.DeliverByTimeZone != null
                ? new Suggestion { Id = j.DeliverByTimeZone.Id, Text = j.DeliverByTimeZone.Name }
                : null,
            AccessorialChargeGroupId = j.AccessorialChargeGroupId,
            Amount = j.UcjbAmount,
            Weight = j.UcjbWeight,
            Quantity = j.UcjbQty
        };

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
}
