using System.Linq;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Services;

public class CountryService(IHttpContextAccessor httpContextAccessor) : ICountryService
{
    public bool IsUsTenant()
    {
        var countryCode = GetCountryCode();
        var usa = Country.Us.GetDescription();
        return countryCode?.ToUpper().Equals(usa) ?? false;
    }

    public string GetCountryCode() =>
        httpContextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(x => x.Type == "CountryCode")?.Value;
}
