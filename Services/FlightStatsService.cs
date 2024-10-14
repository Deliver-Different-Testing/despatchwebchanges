using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Reflection.Emit;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace DespatchWeb.Services;

<<<<<<<< HEAD:Services/FlightStatusService.cs
public class FlightStatusService(HttpClient httpClient) : IFlightStatusService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");

    
========
public class FlightStatsService : IFlightStatsService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId;
    private readonly string _appKey;
    private readonly RestClient _client;
    private readonly string _webhookUrl;

    public FlightStatsService(IConfiguration configuration)
    {
        _appId = configuration?["FlightStatusApiKeys:AppId"];
        _appKey = configuration?["FlightStatusApiKeys:AppKey"];
        _webhookUrl = configuration?["FlightStatusApiKeys:WebhookUrl"];
        _client = new RestClient(BaseUrl);

        if (string.IsNullOrEmpty(_appId) || string.IsNullOrEmpty(_appKey))
            throw new ArgumentException("AppId and AppKey must be provided in the configuration.");
    }

    public async Task CreateFlightRuleByDeparture(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode)
    {
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        var uniqueWebhookId = Guid.NewGuid();
        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day) = SplitDate(departureTime);

        var request =
            new RestRequest(
                $"json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}");

        // Add query parameters
        request.AddQueryParameter("appId", _appId);
        request.AddQueryParameter("appKey", _appKey);

        // Webhook specific
        request.AddQueryParameter("name", uniqueWebhookId);
        request.AddQueryParameter("type", "JSON");
        request.AddQueryParameter("deliverTo", _webhookUrl);

        // Execute the request
        var response = await _client.ExecuteGetAsync<FlightSchedulesResponse>(request);

        if (!response.IsSuccessful)
            throw new Exception($"Failed to retrieve flight information: {response.ErrorMessage}");
    }

>>>>>>>> 85d60e0 (Merged PR 75: Set Up Flight Webhooks):Services/FlightStatsService.cs
    public async Task<List<FlightViewModel>> GetFlightsAsync(
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        DateTime? flightBuffer = null,
        string codeType = null,
        string[] extendedOptions = null)
    {
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        if (string.IsNullOrEmpty(destinationAirportCode))
            throw new ArgumentException("Arrival airport code is required and cannot be null or empty.",
                nameof(destinationAirportCode));

        // If no flight bugger provided, get flights from now
        flightBuffer ??= DateTime.Now;

        // If departureDateTime is not provided, use current date and time
        var effectiveDateTime = departureDateTime ?? DateTime.Now;
        var (year, month, day) = SplitDate(effectiveDateTime);


        // Construct the relative URL
        var relativeUrl = $"json/from/{departureAirportCode}/to/{destinationAirportCode}/departing/{year}/{month}/{day}";


        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["numHours"] = "24";

        if (!string.IsNullOrEmpty(codeType))
            query["codeType"] = codeType;

        if (extendedOptions is { Length: > 0 })
            foreach (var option in extendedOptions)
                query.Add("extendedOptions", option);

        // Construct the final URI
        var fullUrl = $"{BaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString()
        };

        var uri = uriBuilder.Uri;
        Log.Debug($"FlightRequest: {uri}");
        // Execute the request
        var response = await httpClient.GetAsync(uri);
        //response.EnsureSuccessStatusCode();

        Log.Debug($"FlightService StatusCode: {response.StatusCode}");

        var content = await response.Content.ReadAsStringAsync();
        var flightStatusResponse = JsonSerializer.Deserialize<FlightSchedulesResponse>(content);

        if (flightStatusResponse?.ScheduledFlights == null)
            return new List<FlightViewModel>();

<<<<<<<< HEAD:Services/FlightStatusService.cs
        var flightOptions = flightStatusResponse.ScheduledFlights
            .Where(flight => flight.DepartureTime > DateTime.Now && !flight.IsCodeShare)
========
        var flightOptions = response.Data.ScheduledFlights
            .Where(flight => flight.DepartureTime > flightBuffer && !flight.IsCodeShare)
>>>>>>>> 85d60e0 (Merged PR 75: Set Up Flight Webhooks):Services/FlightStatsService.cs
            .Select(flight => new FlightViewModel
            {
                Airline = flightStatusResponse.Appendix?.Airlines.FirstOrDefault(a => a.Fs == flight.CarrierFsCode)?.Name,
                FlightNumber = flight.CarrierFsCode + flight.FlightNumber,
                DepartureTime = flight.DepartureTime,
                ArrivalTime = flight.ArrivalTime,
                DepartureAirport = flight.DepartureAirportFsCode,
                ArrivalAirport = flight.ArrivalAirportFsCode,
                Duration = flight.ArrivalTime - flight.DepartureTime,
                Stops = flight.Stops,
                Aircraft = flightStatusResponse.Appendix?.Equipments
                    .FirstOrDefault(e => e.Iata == flight.FlightEquipmentIataCode)
                    ?.Name,
                ServiceClasses = flight.ServiceClasses,
                IsCodeShare = flight.IsCodeShare,
                CodeShareAirline = flight.IsCodeShare ? flight.Operator?.CarrierFsCode : null
            }).OrderBy(flight => flight.DepartureTime).ToList();

        return flightOptions;
    }

    public async Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime)
    {
        if (string.IsNullOrEmpty(completeFlightNumber))
            throw new ArgumentException("Flight number is required and cannot be null or empty.",
                nameof(completeFlightNumber));

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day) = SplitDate(departureTime);

<<<<<<<< HEAD:Services/FlightStatusService.cs
        
        // Construct the relative URL
        var relativeUrl = $"json/flight/{carrierCode}/{number}/departing/{year}/{month}/{day}";
========
        var request = new RestRequest($"json/flight/{carrierCode}/{flightNumber}/departing/{year}/{month}/{day}");
>>>>>>>> 85d60e0 (Merged PR 75: Set Up Flight Webhooks):Services/FlightStatsService.cs


        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;

        // Construct the final URI
        var fullUrl = $"{BaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString()
        };

        var uri = uriBuilder.Uri;
        Log.Debug($"FlightRequest: {uri}");
        // Execute the request
        var response = await httpClient.GetAsync(uri);
        //response.EnsureSuccessStatusCode();
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve flight information: {response.ReasonPhrase}");

        Log.Debug($"FlightService StatusCode: {response.StatusCode}");

        var content = await response.Content.ReadAsStringAsync();
        var flightStatusResponse = JsonSerializer.Deserialize<FlightSchedulesResponse>(content);


        return flightStatusResponse.ScheduledFlights.FirstOrDefault();
    }

    private static (int year, int month, int day) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);
}
