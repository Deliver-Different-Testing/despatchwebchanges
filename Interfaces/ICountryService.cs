namespace DespatchWeb.Interfaces;

public interface ICountryService
{
    bool IsUsTenant();
    string GetCountryCode();
}