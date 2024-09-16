using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;

namespace DespatchWeb.Automapper;

public class GenericMapperProfiles : Profile
{
    public GenericMapperProfiles()
    {
        CreateMap<INT_stpIsValidLogin_DespatchResult, DispatcherViewModel>()
            .ForMember(dest => dest.StaffID, opt => opt.MapFrom(src => src.StaffID))
            .ForMember(dest => dest.FirstName, opt => opt.MapFrom(src => src.FirstName))
            .ForMember(dest => dest.LastName, opt => opt.MapFrom(src => src.LastName));

        CreateMap<DESWEB_qryClientsActiveResult, ClientActiveViewModel>()
            .ForMember(dest => dest.ID, opt => opt.MapFrom(src => src.ID))
            .ForMember(dest => dest.Text, opt => opt.MapFrom(src => src.Text));
    }
}