using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IAddressLookupService
{
    Task<IReadOnlyList<HereMapsLocationResult>> AutocompleteAddressSearchAsync(string text);
    Task<HereMapsLookupResponse> GetLocationDetailsByIdAsync(string id);
    Task<IReadOnlyList<HereMapsLocationResult>> FetchNearestAddressAsync(double lat, double lng);
}