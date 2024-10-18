using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Reflection.Emit;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Serilog;

using static System.Net.Mime.MediaTypeNames;

namespace DespatchWeb.Services;


public class FlightStatsService(HttpClient httpClient, IHttpContextAccessor contextAccessor) : IFlightStatsService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private const string AlertUrl = "https://api.flightstats.com/flex/alerts/rest/v1";
    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");
    private readonly string _webhookUrl =Environment.GetEnvironmentVariable("FlightWebhook");

    public async Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime, string departureAirportCode)
    {
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        var uniqueWebhookId = Guid.NewGuid();
        var connectionString = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var userName = contextAccessor.HttpContext?.User.FindFirst( ClaimTypes.Name)?.Value;
        var token = AuthenticationExtensions.CreateApiToken(userName, int.Parse(tenantId), connectionString);
        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day) = SplitDate(departureTime);

        // Construct the relative URL
        var relativeUrl = $"json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["name"] = uniqueWebhookId.ToString();
        query["type"] = "JSON";
        query["deliverTo"] = _webhookUrl;
        query["_token"] = requestToken;

        // Construct the final URI
        var fullUrl = $"{AlertUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString()
        };


        var uri = uriBuilder.Uri;
        Log.Debug($"DeliverTo: {_webhookUrl}");
        Log.Debug($"CreateFlightRuleRequest: {uri}");
        // Execute the request
        var response = await httpClient.GetAsync(uri);

        Log.Debug($"FlightService StatusCode: {response.StatusCode}");
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve alert information: {response.ReasonPhrase}");

        var content = await response.Content.ReadAsStringAsync();
        Log.Debug($"CreateRule content response string: {content}");

        var createAlertResponse = JsonSerializer.Deserialize<CreateAlertResponse>(content);


        return createAlertResponse.Rule?.Id;
    }

    public async Task<Rule> GetAlertSubscriptionByIdAsync(string alertId)
    {
        
        // Construct the relative URL
        var relativeUrl = $"json/get/{alertId}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;

        
        // Construct the final URI
        var fullUrl = $"{AlertUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString()
        };


        var uri = uriBuilder.Uri;
        Log.Debug($"GetAlertRequest: {uri}");
        // Execute the request
        var response = await httpClient.GetAsync(uri);
        Log.Debug($"GetAlertRequest StatusCode: {response.StatusCode}");
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve alert information: {response.ReasonPhrase}");

        var content = await response.Content.ReadAsStringAsync();
        var retrieveAlertResponse = JsonSerializer.Deserialize<RetrieveAlertResponse>(content);


        return retrieveAlertResponse.Rule;
    }


    public async Task DeleteAlertByIdAsync(string alertId)
    {
        // Construct the relative URL
        var relativeUrl = $"json/delete/{alertId}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;

        
        // Construct the final URI
        var fullUrl = $"{AlertUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString()
        };


        var uri = uriBuilder.Uri;
        Log.Debug($"DeleteAlertRequest: {uri}");
        // Execute the request
        var response = await httpClient.GetAsync(uri);

        Log.Debug($"DeleteAlertRequest StatusCode: {response.StatusCode}");
        if (response.IsSuccessStatusCode)
            return;

        throw new Exception($"Failed to retrieve alert information: {response.ReasonPhrase}");
    }


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

        // If no flight buffer provided, get flights from now
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


        var flightOptions = flightStatusResponse.ScheduledFlights
            .Where(flight => flight.DepartureTime > flightBuffer && !flight.IsCodeShare)
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

        // Construct the relative URL
        var relativeUrl = $"json/flight/{carrierCode}/{flightNumber}/departing/{year}/{month}/{day}";

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
