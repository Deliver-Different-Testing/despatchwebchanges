using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IAddressLookupService
{
    Task<List<HereMapsLocationResult>> AutocompleteAddressSearchAsync(string text);
    Task<HereMapsLookupResponse> GetLocationDetailsByIdAsync(string id);
    Task<List<HereMapsLocationResult>> FetchNearestAddressAsync(double lat, double lng);
}