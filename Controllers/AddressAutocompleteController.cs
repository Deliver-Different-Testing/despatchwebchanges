using System;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class AddressAutocompleteController(IAddressLookupService addressLookup) : Controller
{
    public async Task<IActionResult> AutocompleteAddressSearch(string text)
    {
        try
        {
            var addressResults = await addressLookup.AutocompleteAddressSearchAsync(text);
            return Json(addressResults);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting autocomplete results: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    public async Task<IActionResult> GetLocationDetailsById(string addressId)
    {
        try
        {
            var address = await addressLookup.GetLocationDetailsByIdAsync(addressId);
            return Json(address);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting location details: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }

    public async Task<IActionResult> FetchNearestAddress(int latitude, int longitude)
    {
        try
        {
            var address = await addressLookup.FetchNearestAddressAsync(latitude, longitude);
            return Json(address);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting nearest address: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }
}