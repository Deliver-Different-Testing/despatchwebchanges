using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace DespatchWeb.Services;

public class FlightStatsService(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    INationwideJobRepository repository,
    ITenantInfoService infoService
) : IFlightStatsService
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
        ArgumentException.ThrowIfNullOrEmpty(completeFlightNumber);
        ArgumentException.ThrowIfNullOrEmpty(departureAirportCode);

        var uniqueWebhookId = Guid.NewGuid();
        var connectionString =
            contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;

        ArgumentException.ThrowIfNullOrEmpty(connectionString);
        ArgumentException.ThrowIfNullOrEmpty(tenantId);

        var token = AuthenticationExtensions.CreateApiToken(userName, int.Parse(tenantId), connectionString, timeZone);

        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);

        var relativeUrl =
            $"json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}";

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
            Query = query.ToString() ?? string.Empty
        };

        var uri = uriBuilder.Uri;
        Log.Debug("DeliverTo: {WebhookUrl}", _webhookUrl);
        Log.Debug("r: {Uri}", uri);

        var response = await httpClient.GetAsync(uri);

        Log.Debug("FlightService StatusCode: {ResponseStatusCode}", response.StatusCode);
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve alert information: {response.ReasonPhrase}");

        var content = await response.Content.ReadAsStringAsync();
        Log.Debug("CreateRule content response string: {Content}", content);

        var createAlertResponse = JsonSerializer.Deserialize<CreateAlertResponse>(content);
        return createAlertResponse.Rule?.Id;
    }

public async Task<List<FlightViewModel>> GetFlightsAsync(
    int jobId,
    DateTime? departureDateTime = null,
    int? airlineId = null,
    int flightBuffer = 0,
    string codeType = null,
    List<string> extendedOptions = null,
    int maxResults = 25)
{
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
    Log.Information("Flight search started for job {JobId} with departure {DepartureDateTime}",
        jobId, departureDateTime);

    var (destinationAirportCode, departureAirportCode) = await repository.GetAirportCodesByJobIdAsync(jobId);
    var activeAirlines = await repository.GetActiveAirlineOptionsAsync();
    var activeAirlineCodes = activeAirlines.Select(x => x.Text).ToList();

    ArgumentException.ThrowIfNullOrEmpty(departureAirportCode);
    ArgumentException.ThrowIfNullOrEmpty(destinationAirportCode);

    var tenantTime = infoService.GetCurrentTenantTime();

    var flightsFrom = departureDateTime == null || departureDateTime < tenantTime
        ? tenantTime
        : departureDateTime;
    flightsFrom = flightsFrom.Value.AddMinutes(flightBuffer);

    var (year, month, day, hour, minute) = SplitDate(flightsFrom.Value);

    var relativeUrl =
        $"json/firstflightout/{departureAirportCode}/to/{destinationAirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}";

    var query = HttpUtility.ParseQueryString(string.Empty);
    query["appId"] = _appId;
    query["appKey"] = _appKey;
    query["payloadType"] = "cargo";
    query["maxResults"] = maxResults.ToString();
    query["includeCodeshares"] = "false";

    // Filter by specific airline if airlineId is provided
    string selectedAirlineCode = null;
    if (airlineId is > 0)
    {
        var selectedAirline = activeAirlines.FirstOrDefault(a => a.Id == airlineId.Value);
        if (selectedAirline != null)
        {
            selectedAirlineCode = selectedAirline.Text;
            Log.Debug("Filtering by specific airline: {Carrier}", selectedAirlineCode);
            query["includeAirlines"] = selectedAirlineCode;
        }
    }
    else if (activeAirlines.Count != 0)
    {
        var combinedAirlines = string.Join(",", activeAirlineCodes);
        Log.Debug("Adding carrier filters: {Carriers}", combinedAirlines);
        query["includeAirlines"] = combinedAirlines;
    }

    if (!string.IsNullOrEmpty(codeType))
    {
        query["codeType"] = codeType;
    }

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
    Log.Debug("FlightRequest: {Uri}", uri);

    var response = await httpClient.GetAsync(uri);

    Log.Debug("FlightStats API call completed in {ElapsedMilliseconds}ms with status {StatusCode}",
        stopwatch.ElapsedMilliseconds, response.StatusCode);

    var content = await response.Content.ReadAsStringAsync();
    var flightStatusResponse = JsonSerializer.Deserialize<FlightConnectionsResponse>(content);

    if (flightStatusResponse?.Connections == null)
    {
        Log.Warning("No connections found for flight search");
        return [];
    }

    // Pre-filter connections to avoid processing unnecessary data
    var validConnections = flightStatusResponse.Connections
        .Where(conn => conn.ScheduledFlight.Count != 0 &&
                        conn.ScheduledFlight.Count <= 2 &&
                        conn.ScheduledFlight.Exists(x => activeAirlineCodes.Contains(x.CarrierFsCode)) &&
                        (airlineId is not > 0 ||
                        conn.ScheduledFlight.Exists(x => x.CarrierFsCode == selectedAirlineCode)))
        .ToList();

    Log.Debug("Filtered down to {ValidConnectionsCount} valid connections out of {TotalConnectionsCount}",
        validConnections.Count, flightStatusResponse.Connections.Count);

    if (validConnections.Count == 0) return [];

    var carrierCodes = validConnections
        .SelectMany(conn => conn.ScheduledFlight)
        .Select(flight => flight.CarrierFsCode)
        .Distinct()
        .ToList();

    var carrierRatesTask = repository.GetBatchCarrierFlightRatesByJobIdAsync(
        jobId,
        carrierCodes,
        flightsFrom.Value);

    var airportsLookup = flightStatusResponse.Appendix?.Airports?
        .ToDictionary(a => a.Fs, a => a) ?? new Dictionary<string, Airport>();

    var airlinesLookup = flightStatusResponse.Appendix?.Airlines?
        .ToDictionary(a => a.Fs, a => a) ?? new Dictionary<string, Airline>();

    var equipmentLookup = flightStatusResponse.Appendix?.Equipments?
        .ToDictionary(e => e.Iata, e => e) ?? new Dictionary<string, Equipment>();

    // Await the carrier rates
    var carrierRates = await carrierRatesTask;

    // Process flights in parallel
    var flightOptions = validConnections.Select(conn =>
    {
        var firstFlight = conn.ScheduledFlight.First();
        var lastFlight = conn.ScheduledFlight.Last();

        decimal amount = 0;
        if (carrierRates.TryGetValue(firstFlight.CarrierFsCode, out var rate))
        {
            amount = rate;
        }

        airportsLookup.TryGetValue(firstFlight.DepartureAirportFsCode, out var departureAirport);
        airportsLookup.TryGetValue(lastFlight.ArrivalAirportFsCode, out var arrivalAirport);
        airlinesLookup.TryGetValue(firstFlight.CarrierFsCode, out var airline);
        equipmentLookup.TryGetValue(firstFlight.FlightEquipmentIataCode, out var equipment);

        return new FlightViewModel
        {
            Airline = airline?.Name,
            FlightNumber = firstFlight.CarrierFsCode + firstFlight.FlightNumber,
            DepartureTime = firstFlight.DepartureTime,
            ArrivalTime = lastFlight.ArrivalTime,
            DepartureAirport = firstFlight.DepartureAirportFsCode,
            ArrivalAirport = lastFlight.ArrivalAirportFsCode,
            Duration = lastFlight.ArrivalTime - firstFlight.DepartureTime,
            Stops = conn.ScheduledFlight.Count - 1,
            Aircraft = equipment?.Name,
            ServiceClasses = firstFlight.ServiceClasses,
            IsCodeShare = firstFlight.IsCodeShare,
            Amount = amount,
            CodeShareAirline = firstFlight.IsCodeShare ? firstFlight.CarrierFsCode : null,
            AirlineId = activeAirlines.FirstOrDefault(x => x.Text == firstFlight.CarrierFsCode)?.Id ?? 0,
            DepartureTimeZone = departureAirport?.TimeZoneRegionName,
            ArrivalTimeZone = arrivalAirport?.TimeZoneRegionName
        };
    }).OrderBy(flight => flight.DepartureTime).ToList();

    stopwatch.Stop();
    Log.Information("Flight search completed in {ElapsedMilliseconds}ms, found {FlightCount} flights",
        stopwatch.ElapsedMilliseconds, flightOptions.Count);

    return flightOptions;
}

    public async Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime)
    {
        if (string.IsNullOrEmpty(completeFlightNumber))
            throw new ArgumentException("Flight number is required and cannot be null or empty.",
                nameof(completeFlightNumber));

        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);


        var relativeUrl = $"json/flight/{carrierCode}/{flightNumber}/departing/{year}/{month}/{day}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;


        var fullUrl = $"{SchedulesBaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString() ?? string.Empty
        };

        var uri = uriBuilder.Uri;
        Log.Debug("FlightRequest: {Uri}", uri);

        var response = await httpClient.GetAsync(uri);

        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve flight information: {response.ReasonPhrase}");

        Log.Debug("FlightService StatusCode: {ResponseStatusCode}", response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        var flightStatusResponse = JsonSerializer.Deserialize<FlightSchedulesResponse>(content);

        return flightStatusResponse.ScheduledFlights.FirstOrDefault();
    }

    private static (int year, int month, int day, int hour, int min) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);
}
