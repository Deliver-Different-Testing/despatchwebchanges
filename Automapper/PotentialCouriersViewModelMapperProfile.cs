using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Automapper;

public class PotentialCouriersViewModelMapperProfile : Profile
{
    public PotentialCouriersViewModelMapperProfile()
    {
        CreateMap<DESWEB_qryPotentialCouriersResult, PotentialCouriersViewModel>()
            .ForMember(dest => dest.CourierID, opt => opt.MapFrom(src => src.CourierID))
            .ForMember(dest => dest.Code, opt => opt.MapFrom(src => src.Code))
            .ForMember(dest => dest.Reason, opt => opt.MapFrom(src => src.Reason))
            .ForMember(dest => dest.RuleNumber, opt => opt.MapFrom(src => src.RuleNumber))
            .ForMember(dest => dest.FirstName, opt => opt.MapFrom(src => src.FirstName));
    }
}
