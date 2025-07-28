using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Log = Serilog.Log;

namespace DespatchWeb.Services;

public class AddressLookupService(
    HttpClient httpClient,
    ITenantInfoService infoService) : IAddressLookupService
{
    private readonly string _hereMapsApiKey = Environment.GetEnvironmentVariable("HereMapsAPIKey");
    private static readonly string[] StringArray = ["categoryQuery", "chainQuery"];
    private const string UsCoordinates = "37.09024,-95.712891";
    private const string NzCoordinates = "-40.900557,174.885971";
    
    public async Task<List<HereMapsLocationResult>> AutocompleteAddressSearchAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length < 3) return [];

        try
        {
            var isUsTenant = infoService.IsUsTenant();
            var queryParams = new Dictionary<string, string>
            {
                ["q"] = text,
                ["apiKey"] = _hereMapsApiKey,
                ["at"] = isUsTenant
                    ? UsCoordinates
                    : NzCoordinates,
                ["in"] = $"countryCode:{(isUsTenant ? "USA" : "NZL")}",
                ["limit"] = "15"
            };

            var queryString = string.Join("&",
                queryParams.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var url = $"https://geocode.search.hereapi.com/v1/autosuggest?{queryString}";

            var response = await httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<HereMapsAutocompleteResponse>(jsonResponse,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            return result?.Items?.Where(item =>
            {
                if (item?.Address?.Label == null || string.IsNullOrWhiteSpace(item.Address.Label))
                    return false;

                if (string.IsNullOrEmpty(item.ResultType)) return true;
                var excludedTypes = StringArray;
                return !excludedTypes.Contains(item.ResultType);
            }).ToList() ?? [];
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error searching for address: {Address}", text);
            ;
            throw;
        }
    }

    public async Task<HereMapsLookupResponse?> GetLocationDetailsByIdAsync(string id)
    {
        try
        {
            var queryParams = new Dictionary<string, string>
            {
                ["id"] = id,
                ["apiKey"] = _hereMapsApiKey,
                ["show"] = "countryInfo,streetInfo"
            };

            var queryString = string.Join("&",
                queryParams.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var url = $"https://lookup.search.hereapi.com/v1/lookup?{queryString}";

            var response = await httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<HereMapsLookupResponse>(jsonResponse, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return result;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting location details for id: {Id}", id);
            throw;
        }
    }

    public async Task<List<HereMapsLocationResult>> FetchNearestAddressAsync(double lat, double lng)
    {
        try
        {
            var queryParams = new Dictionary<string, string>
            {
                ["at"] = $"{lat},{lng}",
                ["apiKey"] = _hereMapsApiKey,
                ["limit"] = "1"
            };

            var queryString = string.Join("&",
                queryParams.Select(kvp => $"{kvp.Key}={Uri.EscapeDataString(kvp.Value)}"));
            var url = $"https://revgeocode.search.hereapi.com/v1/revgeocode?{queryString}";

            var response = await httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<HereMapsAutocompleteResponse>(jsonResponse,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

            return result?.Items ?? [];
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error fetching nearest address for coordinates: {Lat}, {Lng}", lat, lng);
            throw;
        }
    }
}