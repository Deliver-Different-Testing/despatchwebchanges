using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Http;
using Serilog;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;

namespace DespatchWeb.Services;

public class FlightStatsService(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    INationwideJobRepository repository) : IFlightStatsService
{
    private const string ConnectionsBaseUrl = "https://api.flightstats.com/flex/connections/rest/v3/";
    private const string SchedulesBaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private const string AlertUrl = "https://api.flightstats.com/flex/alerts/rest/v1";
    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");
    private readonly string _webhookUrl = Environment.GetEnvironmentVariable("FlightWebhook");

    public async Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode)
    {
        Log.Information("FlightStatsService initialized successfully");
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        var uniqueWebhookId = Guid.NewGuid();
        var connectionString =
            contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;
        var token = AuthenticationExtensions.CreateApiToken(userName, int.Parse(tenantId), connectionString, timeZone);

        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);


        // Construct the relative URL
        var relativeUrl =
            $"json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        ;
        query["appKey"] = _appKey;
        query["name"] = uniqueWebhookId.ToString();
        query["type"] = "JSON";
        query["deliverTo"] = _webhookUrl;
        query["_token"] = requestToken;

        // Construct the final URI
        var fullUrl = $"{AlertUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString() ?? string.Empty
        };


        var uri = uriBuilder.Uri;
        Log.Debug($"DeliverTo: {_webhookUrl}");
        Log.Debug($"r: {uri}");
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

    public async Task<List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        List<string> includeAirlines = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null)
    {
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        if (string.IsNullOrEmpty(destinationAirportCode))
            throw new ArgumentException("Arrival airport code is required and cannot be null or empty.",
                nameof(destinationAirportCode));

        // If no flight buffer provided, get flights from now (using tenant time zone)
        var tenantTimeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var tenantTimeZoneInfo = TimeZoneInfo.FindSystemTimeZoneById(tenantTimeZone ?? string.Empty);
        var utcDateTime = DateTime.UtcNow;
        var tenantTime = TimeZoneInfo.ConvertTimeFromUtc(utcDateTime, tenantTimeZoneInfo);

        // Get datetime to sort flights from
        var flightsFrom = departureDateTime == null || departureDateTime < tenantTime
            ? tenantTime
            : departureDateTime;
        flightsFrom = flightsFrom.Value.AddMinutes(flightBuffer);

        var (year, month, day, hour, minute) = SplitDate(flightsFrom.Value);

        // Construct the relative URL
        var relativeUrl =
            $"json/firstflightout/{departureAirportCode}/to/{destinationAirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["payloadType"] = "cargo";
        query["maxResults"] = "100";
        query["includeCodeshares"] = "false";

        if (includeAirlines != null && includeAirlines.Count != 0)
        {
            var combinedAirlines = string.Join(",", includeAirlines);
            Log.Debug("Adding carrier filters: {Carriers}", combinedAirlines);
            query["includeAirlines"] = combinedAirlines;
        }

        if (!string.IsNullOrEmpty(codeType))
            query["codeType"] = codeType;

        if (extendedOptions != null && extendedOptions.Count != 0)
        {
            var combinedOptions = string.Join(",", extendedOptions);
            Log.Debug("Adding extended options: {Options}", combinedOptions);
            query.Add("extendedOptions", combinedOptions);
        }

        // Construct the final URI
        var fullUrl = $"{ConnectionsBaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString() ?? string.Empty
        };

        var uri = uriBuilder.Uri;
        Log.Debug($"FlightRequest: {uri}");

        // Execute the request
        var response = await httpClient.GetAsync(uri);

        Log.Debug($"FlightService StatusCode: {response.StatusCode}");

        var content = await response.Content.ReadAsStringAsync();
        var flightStatusResponse = JsonSerializer.Deserialize<FlightConnectionsResponse>(content);

        if (flightStatusResponse?.Connections == null)
            return [];

        var flightOptions = await Task.WhenAll(flightStatusResponse.Connections
            .Where(conn => conn.ScheduledFlight.Count != 0)
            .Select(async conn =>
            {
                var firstFlight = conn.ScheduledFlight.First();
                var lastFlight = conn.ScheduledFlight.Last();

                // Get amount from stored proc
                var amount = await repository.GetCarrierFlightRateByJobIdAsync(
                    jobId,
                    firstFlight.CarrierFsCode,
                    conn.ScheduledFlight.Count != 0,
                    firstFlight.DepartureTime);

                return new FlightViewModel
                {
                    Airline = flightStatusResponse.Appendix?.Airlines
                        .FirstOrDefault(a => a.Fs == firstFlight.CarrierFsCode)
                        ?.Name,
                    FlightNumber = firstFlight.CarrierFsCode + firstFlight.FlightNumber,
                    DepartureTime = firstFlight.DepartureTime,
                    ArrivalTime = lastFlight.ArrivalTime,
                    DepartureAirport = firstFlight.DepartureAirportFsCode,
                    ArrivalAirport = lastFlight.ArrivalAirportFsCode,
                    Duration = lastFlight.ArrivalTime - firstFlight.DepartureTime,
                    Stops = conn.ScheduledFlight.Count - 1, // Number of connections equals number of flights minus 1
                    Aircraft = flightStatusResponse.Appendix?.Equipments
                        .FirstOrDefault(e => e.Iata == firstFlight.FlightEquipmentIataCode)
                        ?.Name,
                    ServiceClasses = firstFlight.ServiceClasses,
                    IsCodeShare = firstFlight.IsCodeShare,
                    Amount = amount,
                    CodeShareAirline = firstFlight.IsCodeShare ? firstFlight.CarrierFsCode : null
                };
            }));

        return flightOptions.OrderBy(flight => flight.DepartureTime).ToList();
    }

    public async Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime)
    {
        if (string.IsNullOrEmpty(completeFlightNumber))
            throw new ArgumentException("Flight number is required and cannot be null or empty.",
                nameof(completeFlightNumber));

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);

        // Construct the relative URL
        var relativeUrl = $"json/flight/{carrierCode}/{flightNumber}/departing/{year}/{month}/{day}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;

        // Construct the final URI
        var fullUrl = $"{SchedulesBaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString() ?? string.Empty
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

    private static (int year, int month, int day, int hour, int min) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);

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
            Query = query.ToString() ?? string.Empty
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
            Query = query.ToString() ?? string.Empty
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
}
