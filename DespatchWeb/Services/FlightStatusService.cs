using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Models;
using Microsoft.Extensions.Configuration;
using RestSharp;

namespace DespatchWeb.Services;

public class FlightStatusService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId;
    private readonly string _appKey;

    public FlightStatusService(IConfiguration configuration)
    {
        _appId = configuration?["FlightStatusApiKeys:AppId"];
        _appKey = configuration?["FlightStatusApiKeys:AppKey"];

        if (string.IsNullOrEmpty(_appId) || string.IsNullOrEmpty(_appKey))
            throw new ArgumentException("AppId and AppKey must be provided in the configuration.");
    }

    public async Task<List<ScheduledFlight>> GetDepartingFlightsAsync(
        string departureAirportCode,
        int? year = null,
        int? month = null,
        int? day = null,
        int? hourOfDay = null,
        string codeType = null,
        string[] extendedOptions = null)
    {
        // If date/time parameters are not provided, use current date and time
        var now = DateTime.Now;
        if (year == 0) year = now.Year;
        if (month == 0) month = now.Month;
        if (day == 0) day = now.Day;
        if (hourOfDay == -1) hourOfDay = now.Hour;

        var client = new RestClient(BaseUrl);
        var request = new RestRequest($"json/from/{departureAirportCode}/departing/{year}/{month}/{day}/{hourOfDay}");

        // Add query parameters
        request.AddQueryParameter("appId", _appId);
        request.AddQueryParameter("appKey", _appKey);

        if (!string.IsNullOrEmpty(codeType)) request.AddQueryParameter("codeType", codeType);

        if (extendedOptions is { Length: > 0 })
            foreach (var option in extendedOptions)
                request.AddQueryParameter("extendedOptions", option);

        // Add header parameters
        request.AddHeader("appId", _appId);
        request.AddHeader("appKey", _appKey);

        // Execute the request
        var response = await client.ExecuteGetAsync<FlightStatusResponse>(request);

        var flightList = GetFlightList(response.Data);
        return flightList;
    }

    private static List<ScheduledFlight> GetFlightList(FlightStatusResponse response) =>
        (response?.ScheduledFlights ?? new List<ScheduledFlight>()).OrderByDescending(sf => sf.DepartureTime).ToList();
}
