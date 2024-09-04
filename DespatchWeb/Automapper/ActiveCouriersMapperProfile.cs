using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Automapper;

public class ActiveCouriersMapperProfile : Profile
{
    public ActiveCouriersMapperProfile()
    {
        CreateMap<DES_qryCourierCombo_ActiveResult, ActiveCouriersViewModel>()
            .ForMember(dest => dest.CourierID, opt => opt.MapFrom(src => src.CourierID))
            .ForMember(dest => dest.Code, opt => opt.MapFrom(src => src.Code))
            .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Name))
            .ForMember(dest => dest.DangerousGoods, opt => opt.MapFrom(src => src.DangerousGoods))
            .ForMember(dest => dest.DGLicenseExpiry, opt => opt.MapFrom(src => src.DGLicenseExpiry))
            .AfterMap((src, dest) =>
            {
                dest.Label = $"{dest.Code} {dest.Name}";
                dest.Text = $"{dest.Code} {dest.Name}";
            });

        CreateMap<DESWEB_qryCourierActiveResult, ActiveCouriersViewModel>()
            .ForMember(dest => dest.CourierID, opt => opt.MapFrom(src => src.CourierID))
            .ForMember(dest => dest.Code, opt => opt.MapFrom(src => src.Code))
            .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Name))
            .ForMember(dest => dest.DangerousGoods, opt => opt.MapFrom(src => src.DangerousGoods))
            .ForMember(dest => dest.DGLicenseExpiry, opt => opt.MapFrom(src => src.DGLicenseExpiry))
            .AfterMap((src, dest) =>
            {
                dest.Label = $"{dest.Code} {dest.Name}";
                dest.Text = $"{dest.Code} {dest.Name}";
            });
    }
}
