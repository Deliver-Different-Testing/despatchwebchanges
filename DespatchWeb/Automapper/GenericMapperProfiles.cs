using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Automapper;

public class GenericMapperProfiles : Profile
{
    public GenericMapperProfiles()
    {
        CreateMap<INT_stpIsValidLogin_DespatchResult, DispatcherViewModel>();

        CreateMap<DESWEB_qryClientsActiveResult, ClientActiveViewModel>();

        CreateMap<DES_stpSettingsResult, SettingsViewModel>();

        CreateMap<MAP_stpClearListArea_EnvelopeResult, ClearListEnvelopeViewModel>();

        CreateMap<DES_qdfCourier_ClearListsResult, CourierClearListViewModel>()
            ?.ForMember(dest => dest.CourierCode,
                opt => opt.MapFrom(src => src.Hash));

        CreateMap<DESWEB_qryPotentialCouriersResult, PotentialCouriersViewModel>();

        CreateMap<DESWEB_qryCourierActiveResult, ActiveCouriersViewModel>();

        CreateMap<DES_qryCourierCombo_ActiveResult, ActiveCouriersViewModel>();

        CreateMap<MAP_stpCourierGPS_LastPositionTodayResult, CourierPosition>();
    }
}