using System;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Automapper;

public class JobViewModelMapperProfile : Profile
{
    public JobViewModelMapperProfile()
    {
        CreateMap<DeswebQryDespatch, JobViewModel>()
            .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.UcjbId))
            .ForMember(dest => dest.RootParentId, opt => opt.MapFrom(src => src.RootParentId))
            .ForMember(dest => dest.Time, opt => opt.MapFrom(src => src.UcjbTime))
            .ForMember(dest => dest.Direct, opt => opt.MapFrom(src => src.Direct))
            .ForMember(dest => dest.Van, opt => opt.MapFrom(src => src.UcjbVan))
            .ForMember(dest => dest.VanOk, opt => opt.MapFrom(src => src.VanOk))
            .ForMember(dest => dest.Truck, opt => opt.MapFrom(src => src.Truck))
            .ForMember(dest => dest.SaturdayDelivery, opt => opt.MapFrom(src => src.SaturdayDelivery))
            .ForMember(dest => dest.Return, opt => opt.MapFrom(src => src.UcjbReturn))
            .ForMember(dest => dest.PickupFrom, opt => opt.MapFrom(src => src.UcjbPickUpFrom))
            .ForMember(dest => dest.JobNo, opt => opt.MapFrom(src => src.UcjbNumber))
            .ForMember(dest => dest.Speed, opt => opt.MapFrom(src => src.SpeedShortName))
            .ForMember(dest => dest.SpeedName, opt => opt.MapFrom(src => src.SpeedName))
            .ForMember(dest => dest.SpeedId, opt => opt.MapFrom(src => src.UcjbSpeed))
            .ForMember(dest => dest.Notify, opt => opt.MapFrom(src => src.NotifiedSpeed))
            .ForMember(dest => dest.NotifiedName, opt => opt.MapFrom(src => src.NotifiedName))
            .ForMember(dest => dest.AcceptedJobTypeId, opt => opt.MapFrom(src => src.AcceptedJobTypeId))
            .ForMember(dest => dest.AcceptedName, opt => opt.MapFrom(src => src.OriginalName))
            .ForMember(dest => dest.NotifiedJobTypeId, opt => opt.MapFrom(src => src.NotifiedJobTypeId))
            .ForMember(dest => dest.Vehicle, opt => opt.MapFrom(src => new Vehicle
            {
                Id = src.UcjbVan ? (short?)Enums.Vehicle.Van : src.UcjbSize,
                Label = src.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(src.UcjbSize ?? 2))
            }))
            .ForMember(dest => dest.Client, opt => opt.MapFrom(src => src.UcclCode))
            .ForMember(dest => dest.ClientId, opt => opt.MapFrom(src => src.UcjbClientId))
            .ForMember(dest => dest.ClientName, opt => opt.MapFrom(src => src.ClientName))
            .ForMember(dest => dest.JobType, opt => opt.MapFrom(src => (int)(src.UcjbType ?? 0)))
            .ForMember(dest => dest.From, opt => opt.MapFrom(src => src.SuburbFrom))
            .ForMember(dest => dest.FromSuburbId, opt => opt.MapFrom(src => src.FromSuburbId))
            .ForMember(dest => dest.FromSuburbName, opt => opt.MapFrom(src => src.FromSuburbName))
            .ForMember(dest => dest.FromPostCode, opt => opt.MapFrom(src => src.FromPostCode))
            .ForMember(dest => dest.FromAddress, opt => opt.MapFrom(src => src.UcjbFromAddr))
            .ForMember(dest => dest.FromContactName, opt => opt.MapFrom(src => src.PickupFromContact))
            .ForMember(dest => dest.FromContactNumber, opt => opt.MapFrom(src => src.PickupFromPhone))
            .ForMember(dest => dest.To, opt => opt.MapFrom(src => src.SuburbTo))
            .ForMember(dest => dest.ToSuburbId, opt => opt.MapFrom(src => src.ToSuburbId))
            .ForMember(dest => dest.ToSuburbName, opt => opt.MapFrom(src => src.ToSuburbName))
            .ForMember(dest => dest.ToPostCode, opt => opt.MapFrom(src => src.ToPostCode))
            .ForMember(dest => dest.ToAddress, opt => opt.MapFrom(src => src.UcjbToAddr))
            .ForMember(dest => dest.ToCity, opt => opt.MapFrom(src => src.ToCity))
            .ForMember(dest => dest.Courier, opt => opt.MapFrom(src => src.CourierCode))
            .ForMember(dest => dest.Remain, opt => opt.MapFrom(src => src.RemainTime))
            .ForMember(dest => dest.StatusId, opt => opt.MapFrom(src => src.UcjbStatus))
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.UcjsCode))
            .ForMember(dest => dest.Lp, opt => opt.MapFrom(src => src.UcjbLatePick))
            .ForMember(dest => dest.Ld, opt => opt.MapFrom(src => src.UcjbLateDel))
            .ForMember(dest => dest.ContactName, opt => opt.MapFrom(src => src.UcjbContact))
            .ForMember(dest => dest.Phone, opt => opt.MapFrom(src => src.DeliverToPhone))
            .ForMember(dest => dest.SpeedAccepted, opt => opt.MapFrom(src => src.OriginalSpeed))
            .ForMember(dest => dest.Size, opt => opt.MapFrom(src => new Vehicle
            {
                Id = src.UcjbVan ? (short?)Enums.Vehicle.Van : src.UcjbSize,
                Label = src.UcjbVan ? "Van" : Enum.GetName(typeof(Enums.Vehicle), (int)(src.UcjbSize ?? 2))
            }))
            .ForMember(dest => dest.Weight, opt => opt.MapFrom(src => src.UcjbWeight))
            .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.UcjbQty))
            .ForMember(dest => dest.RefA, opt => opt.MapFrom(src => src.UcjbClientRefa))
            .ForMember(dest => dest.RefB, opt => opt.MapFrom(src => src.UcjbClientRefb))
            .ForMember(dest => dest.OurRef, opt => opt.MapFrom(src => src.UcjbOurRef))
            .ForMember(dest => dest.SigNotRequired, opt => opt.MapFrom(src => src.SigNotRequired))
            .ForMember(dest => dest.Charge, opt => opt.MapFrom(src => $"{src.UcjbAmount:C}"))
            .ForMember(dest => dest.Date, opt => opt.MapFrom(src => src.UcjbDate.ToString("dd/MM/yyyy")))
            .ForMember(dest => dest.Booked,
                opt => opt.MapFrom(src =>
                    DateTime.Parse(src.UcjbDate.ToString("yyyy-MM-dd") + " " +
                                   src.UcjbTime.Value.ToString("HH:mm:ss"))))
            .ForMember(dest => dest.DispatchTime, opt => opt.MapFrom(src => src.UcjbDispTime))
            .ForMember(dest => dest.PuTime, opt => opt.MapFrom(src => src.Putime))
            .ForMember(dest => dest.ClientNotes, opt => opt.MapFrom(src => src.ClientNotes))
            .ForMember(dest => dest.InternalNotes, opt => opt.MapFrom(src => src.JobNotes))
            .ForMember(dest => dest.ChildNotes, opt => opt.MapFrom(src => src.ChildNotes))
            .ForMember(dest => dest.PickUpLatitude, opt => opt.MapFrom(src => src.PickUpLatitude))
            .ForMember(dest => dest.PickUpLongitude, opt => opt.MapFrom(src => src.PickUpLongitude))
            .ForMember(dest => dest.DeliveryLatitude, opt => opt.MapFrom(src => src.DeliveryLatitude))
            .ForMember(dest => dest.DeliveryLongitude, opt => opt.MapFrom(src => src.DeliveryLongitude))
            .ForMember(dest => dest.CourierLatitude, opt => opt.MapFrom(src => src.CourierLatitude))
            .ForMember(dest => dest.CourierLongitude, opt => opt.MapFrom(src => src.CourierLongitude))
            .ForMember(dest => dest.RunOrder, opt => opt.MapFrom(src => src.PickRunOrder))
            .ForMember(dest => dest.CourierData, opt => opt.MapFrom(src => new CourierData
            {
                Courier = src.CourierCode + " " + src.CourierName,
                CourierId = src.UcjbCourierId
            }))
            .ForMember(dest => dest.AllowDispatch, opt => opt.MapFrom(src => src.AllowDespatch))
            .ForMember(dest => dest.AllowSplit, opt => opt.MapFrom(src => src.AllowSplit))
            .ForMember(dest => dest.DgClass, opt => opt.MapFrom(src => src.Dgclass))
            .ForMember(dest => dest.DgDocumentation, opt => opt.MapFrom(src => src.Dgdocument))
            .ForMember(dest => dest.DisplaySplitJobDetail, opt => opt.MapFrom(src => src.DisplaySplitJobDetail == 1))
            .ForMember(dest => dest.TruckWeightLimit, opt => opt.MapFrom(src => src.TruckWeightLimit))
            .ForMember(dest => dest.TruckStartTime, opt => opt.MapFrom(src => src.TruckStartTime))
            .ForMember(dest => dest.TruckHours, opt => opt.MapFrom(src => src.TruckHours))
            .ForMember(dest => dest.PrivateRes, opt => opt.MapFrom(src => (src.DeliverToPrivateBusiness ?? 0) == 1))
            .ForMember(dest => dest.PickupTime, opt => opt.MapFrom(src => src.PickupTime))
            .ForMember(dest => dest.DeliveryTime, opt => opt.MapFrom(src => src.DeliveryTime))
            .ForMember(dest => dest.AlertLatePickup, opt => opt.MapFrom(src => src.AlertLatePickUp))
            .ForMember(dest => dest.AlertLateDelivery, opt => opt.MapFrom(src => src.AlertLateDelivery))
            .ForMember(dest => dest.Minutes, opt => opt.MapFrom(src => src.Minutes))
            .ForMember(dest => dest.DeliverToContact, opt => opt.MapFrom(src => src.DeliverToContact))
            .ForMember(dest => dest.PodPhoto, opt => opt.MapFrom(src => src.DeliveryPhoto))
            .ForMember(dest => dest.PodName, opt => opt.MapFrom(src => src.UcjbPodname))
            .ForMember(dest => dest.CompletedTime, opt => opt.MapFrom(src => src.UcjbComplTime))
            .ForMember(dest => dest.TrackingMethod, opt => opt.MapFrom(src => src.TrackingMethod))
            .ForMember(dest => dest.TrackingMobile, opt => opt.MapFrom(src => src.TrackingMobile))
            .ForMember(dest => dest.TrackingEmail, opt => opt.MapFrom(src => src.TrackingEmail))
            .ForMember(dest => dest.UdStatus, opt => opt.MapFrom(src => src.Udstatus))
            .ForMember(dest => dest.RatedManually, opt => opt.MapFrom(src => src.RatedManually))
            .ForMember(dest => dest.Attention, opt => opt.MapFrom(src => src.UcjbAttention))
            .ForMember(dest => dest.Pedal, opt => opt.MapFrom(src => src.UcjbCbd))
            .ForMember(dest => dest.Locked, opt => opt.MapFrom(src => src.UcjbLocked ?? false))
            .ForMember(dest => dest.Invoiced, opt => opt.MapFrom(src => false))
            .ForMember(dest => dest.InternalStatusId, opt => opt.MapFrom(src => src.InternalStatus))
            .ForMember(dest => dest.Reprice, opt => opt.MapFrom(src => src.Reprice))
            .ForMember(dest => dest.FollowupTime, opt => opt.MapFrom(src => src.FollowupTime))
            .ForMember(dest => dest.GstRate, opt => opt.MapFrom(src => src.Gstrate))
            .ForMember(dest => dest.ScheduleName, opt => opt.MapFrom(src => src.ScheduleName))
            .ForMember(dest => dest.LoggedInContactName, opt => opt.MapFrom(src => src.LoggedInContactName))
            .ForMember(dest => dest.StatusName, opt => opt.MapFrom(src => src.StatusName));
    }
}