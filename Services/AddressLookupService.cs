using System.Text.Json;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Log = Serilog.Log;

namespace DespatchWeb.Services;

/// <summary>
/// Service for address lookup and geocoding operations using the HERE Maps API.
/// </summary>
public sealed class AddressLookupService(
    HttpClient httpClient,
    ITenantInfoService infoService) : IAddressLookupService
{
    private readonly string _hereMapsApiKey = Environment.GetEnvironmentVariable("HereMapsAPIKey");
    private static readonly string[] StringArray = ["categoryQuery", "chainQuery"];
    private const string UsCoordinates = "37.09024,-95.712891";
    private const string NzCoordinates = "-40.900557,174.885971";
    private static readonly JsonSerializerOptions CaseInsensitiveJsonOptions = new() { PropertyNameCaseInsensitive = true };
    
    /// <summary>
    /// Searches for address suggestions based on partial text input using HERE Maps autosuggest API.
    /// Filters results by tenant country (US or NZ) and excludes category/chain queries.
    /// </summary>
    /// <param name="text">The partial address text to search for (minimum 3 characters).</param>
    /// <returns>A list of matching location results with address labels and coordinates.</returns>
    public async Task<IReadOnlyList<HereMapsLocationResult>> AutocompleteAddressSearchAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length < 3)
        {
            return [];
        }

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
            var result = JsonSerializer.Deserialize<HereMapsAutocompleteResponse>(jsonResponse, CaseInsensitiveJsonOptions);

            return result?.Items?.Where(item =>
            {
                if (item?.Address?.Label == null || string.IsNullOrWhiteSpace(item.Address.Label))
                {
                    return false;
                }

                if (string.IsNullOrEmpty(item.ResultType))
                {
                    return true;
                }

                var excludedTypes = StringArray;
                return !excludedTypes.Contains(item.ResultType);
            }).ToList() ?? [];
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error searching for address: {Address}", text);
            throw;
        }
    }

    /// <summary>
    /// Retrieves detailed location information for a specific HERE Maps place ID.
    /// </summary>
    /// <param name="id">The HERE Maps place ID to look up.</param>
    /// <returns>Detailed location information including address, country info, and street details.</returns>
    public async Task<HereMapsLookupResponse> GetLocationDetailsByIdAsync(string id)
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
            var result = JsonSerializer.Deserialize<HereMapsLookupResponse>(jsonResponse, CaseInsensitiveJsonOptions);

            return result;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting location details for id: {Id}", id);
            throw;
        }
    }

    /// <summary>
    /// Performs reverse geocoding to find the nearest address for given coordinates.
    /// </summary>
    /// <param name="lat">The latitude coordinate.</param>
    /// <param name="lng">The longitude coordinate.</param>
    /// <returns>A list containing the nearest address result.</returns>
    public async Task<IReadOnlyList<HereMapsLocationResult>> FetchNearestAddressAsync(double lat, double lng)
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
            var result = JsonSerializer.Deserialize<HereMapsAutocompleteResponse>(jsonResponse, CaseInsensitiveJsonOptions);

            return result?.Items ?? [];
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error fetching nearest address for coordinates: {Lat}, {Lng}", lat, lng);
            throw;
        }
    }
}