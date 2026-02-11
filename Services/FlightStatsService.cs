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

/// <summary>
/// Service for integrating with the FlightStats API to search flights and manage flight alerts.
/// </summary>
public class FlightStatsService(
    HttpClient httpClient,
    IHttpContextAccessor contextAccessor,
    INationwideJobRepository repository,
    ITenantInfoService infoService
) : IFlightStatsService
{
    private const string ConnectionsBaseUrl = "https://api.flightstats.com/flex/connections/rest/v3/";
    private const string AlertUrl = "https://api.flightstats.com/flex/alerts/rest/v1";

    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");
    private readonly string _webhookUrl = Environment.GetEnvironmentVariable("FlightWebhook");

    /// <summary>
    /// Creates a flight alert rule to receive webhook notifications for flight status changes.
    /// </summary>
    /// <param name="completeFlightNumber">The complete flight number (e.g., "AA1234").</param>
    /// <param name="departureTime">The departure date and time.</param>
    /// <param name="departureAirportCode">The departure airport IATA code.</param>
    /// <returns>The created rule ID, or null if creation fails.</returns>
    public async Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber,
        DateTimeOffset departureTime,
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

        // Webhook Events
        var flightWebhookAlertTypes = await repository.GetWebhookEventsAsStringAsync();

        // Build the URL directly
        var url =
            $"{AlertUrl}/json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["name"] = uniqueWebhookId.ToString();
        query["type"] = "JSON";
        query["deliverTo"] = _webhookUrl;
        query["events"] = flightWebhookAlertTypes;
        query["_token"] = requestToken;

        var uriBuilder = new UriBuilder(url)
        {
            Query = query.ToString() ?? string.Empty
        };

        var uri = uriBuilder.Uri;
        Log.Debug("DeliverTo: {WebhookUrl}", _webhookUrl);
        Log.Debug("CreateFlightRule Request: {Uri}", uri);

        try
        {
            var response = await httpClient.GetAsync(uri);
            Log.Debug("FlightService StatusCode: {ResponseStatusCode}", response.StatusCode);

            var content = await response.Content.ReadAsStringAsync();
            Log.Debug("CreateRule content response: {Content}", content);

            if (!response.IsSuccessStatusCode)
            {
                Log.Error("Failed to create flight alert. Status: {StatusCode}, Content: {Content}",
                    response.StatusCode, content);
                throw new Exception($"Failed to create flight alert: {response.ReasonPhrase}. Response: {content}");
            }

            var createAlertResponse = JsonSerializer.Deserialize<CreateAlertResponse>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (createAlertResponse?.Error?.ErrorId != null)
            {
                Log.Error("{ErrorMessage}", createAlertResponse.Error.ErrorMessage);
                throw new Exception(
                    $"Failed to create flight alert. ErrorId: {createAlertResponse.Error.ErrorId}. Response: {createAlertResponse.Error.ErrorMessage}");
            }

            if (createAlertResponse?.Rule?.Id == null)
            {
                Log.Warning("CreateAlertResponse or Rule ID is null. Full response: {Content}", content);
                return null;
            }

            Log.Information("Successfully created flight alert with ID: {RuleId} for flight {FlightNumber}",
                createAlertResponse.Rule.Id, completeFlightNumber);

            return createAlertResponse.Rule.Id;
        }
        catch (HttpRequestException ex)
        {
            Log.Error(ex, "HTTP error creating flight rule for {FlightNumber}", completeFlightNumber);
            throw;
        }
        catch (JsonException ex)
        {
            Log.Error(ex, "JSON deserialization error for flight rule response");
            throw;
        }
    }

    /// <summary>
    /// Deletes an existing flight alert rule by its ID.
    /// </summary>
    /// <param name="webhookId">The ID of the flight rule/webhook to delete.</param>
    public async Task DeleteFlightRuleById(string webhookId)
    {
        if (string.IsNullOrEmpty(webhookId)) return;

        var relativeUrl =
            $"json/delete/{webhookId}";

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
        Log.Debug("r: {Uri}", uri);

        var response = await httpClient.GetAsync(uri);

        Log.Debug("FlightService StatusCode: {ResponseStatusCode}", response.StatusCode);
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to disconnect alert alert: {response.ReasonPhrase}");
    }

    /// <summary>
    /// Searches for available flights between airports using the FlightStats connections API.
    /// Filters by active airlines and maps results to view models with segment details.
    /// </summary>
    /// <param name="jobId">The job ID for logging purposes.</param>
    /// <param name="departureDateTime">The desired departure date/time.</param>
    /// <param name="airlineId">Optional specific airline ID to filter by.</param>
    /// <param name="departureAirportId">The departure airport ID.</param>
    /// <param name="arrivalAirportId">The arrival airport ID.</param>
    /// <param name="codeType">Optional code type filter.</param>
    /// <param name="extendedOptions">Optional extended search options.</param>
    /// <param name="minimumLayoverMinutes">Minimum layover time for connecting flights (default 60 minutes).</param>
    /// <returns>A list of available flight options sorted by arrival time.</returns>
    public async Task<List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTimeOffset? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int? arrivalAirportId = null,
        string codeType = null,
        List<string> extendedOptions = null,
        int minimumLayoverMinutes = 60
    )
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        Log.Information("Flight search started for job {JobId} with departure {DepartureDateTime}",
            jobId, departureDateTime);

        // Airports
        var airports = await repository.GetAllActiveAirportsAsync();
        var departureAirport = airports.FirstOrDefault(x => x.AirportId == departureAirportId);
        var arrivalAirport = airports.FirstOrDefault(x => x.AirportId == arrivalAirportId);

        if (departureAirport is null)
            throw new ArgumentException($"Departure airport with ID {departureAirportId} not found in active airports");
        if (arrivalAirport is null)
            throw new ArgumentException($"Arrival airport with ID {arrivalAirportId} not found in active airports");

        var activeAirlineCodes = await repository.GetActiveAirlineCodesAsync();
        Log.Information("Found {Count} active airline codes: [{Codes}]",
            activeAirlineCodes.Count,
            string.Join(", ", activeAirlineCodes));

        var flightsFrom = CalculateFlightSearchStartTime(departureDateTime, departureAirport.FlightBufferMinutes);
        var (year, month, day, hour, minute) = SplitDate(flightsFrom);

        var relativeUrl =
            $"json/firstflightout/{departureAirport.AirportCode}/to/{arrivalAirport.AirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["payloadType"] = "cargo";
        query["maxResults"] = "80";
        query["includeCodeshares"] = "false";
        query["maxConnections"] = "1"; //default is 2
        query["numHours"] = "24"; //How many hours flights after the dateTime to search default are 6
        query["minimumConnectTime"] = minimumLayoverMinutes.ToString();

        // Filter by specific airline if airlineId is provided
        if (airlineId is > 0)
        {
            var selectedAirline = await repository.GetAirlineCodeByIdAsync(airlineId.Value);
            if (string.IsNullOrEmpty(selectedAirline))
                throw new ArgumentException($"Airline with ID {airlineId} not found");

            Log.Debug("Filtering FlightWebhooks by specific airline: {Carrier}", selectedAirline);
            query["includeAirlines"] = selectedAirline;
        }
        else if (activeAirlineCodes.Count != 0)
        {
            var combinedAirlines = string.Join(",", activeAirlineCodes);
            Log.Information("Filtering flights by {Count} active carriers: {Carriers}", activeAirlineCodes.Count, combinedAirlines);
            query["includeAirlines"] = combinedAirlines;
        }
        else
        {
            Log.Warning("No active airline codes found - flight search will not filter by airline");
        }

        if (!string.IsNullOrEmpty(codeType)) query["codeType"] = codeType;

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

        if (!response.IsSuccessStatusCode)
        {
            Log.Error("FlightStats API returned error. Status: {StatusCode}, Content: {Content}",
                response.StatusCode, content);
            throw new HttpRequestException($"FlightStats API error: {response.StatusCode}. Response: {content}");
        }

        var flightStatusResponse = JsonSerializer.Deserialize<FlightConnectionsRoot>(content);
        if (flightStatusResponse is null)
        {
            Log.Error("Failed to deserialize FlightStats response. Content: {Content}", content);
            throw new InvalidOperationException("Failed to parse FlightStats API response");
        }

        // Pre-filter connections to avoid processing unnecessary data
        var connections = flightStatusResponse.Connections;
        if (connections is null) return [];

        var flightOptions = connections
            .Where(conn =>
                conn.ScheduledFlight.Count != 0 &&
                conn.ScheduledFlight.All(segment =>
                    segment.Stops < 1)) // Exclude connections with segments having more than 1 stop
            .Select(conn =>
            {
                var firstFlight = conn.ScheduledFlight.First();
                var lastFlight = conn.ScheduledFlight.Last();

                // Map flight segments with detailed info from the appendix
                var segments = conn.ScheduledFlight
                    .Select((segment, index) =>
                    {
                        var depAirport = flightStatusResponse.Appendix?.Airports
                            ?.FirstOrDefault(a => a.Fs == segment.DepartureAirportFsCode);

                        var arrAirport = flightStatusResponse.Appendix?.Airports
                            ?.FirstOrDefault(a => a.Fs == segment.ArrivalAirportFsCode);

                        var equipment = flightStatusResponse.Appendix?.Equipments
                            ?.FirstOrDefault(e => e.Iata == segment.FlightEquipmentIataCode);

                        var airline = flightStatusResponse.Appendix?.Airlines
                            ?.FirstOrDefault(a =>
                                a.Fs == segment.CarrierFsCode && activeAirlineCodes.Contains(segment.CarrierFsCode));

                        return new FlightSegmentViewModel
                        {
                            SegmentOrder = index,
                            CarrierFsCode = segment.CarrierFsCode,
                            FlightNumber = segment.FlightNumber,
                            DepartureTime = CalculateCorrectDateTimeOffset(segment.DepartureTime, depAirport),
                            ArrivalTime = CalculateCorrectDateTimeOffset(segment.ArrivalTime, arrAirport),
                            DepartureAirportId = departureAirport.AirportId,
                            DepartureAirportFsCode = segment.DepartureAirportFsCode,
                            DepartureTerminal = segment.DepartureTerminal,
                            ArrivalAirportId = arrivalAirport.AirportId,
                            ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                            ArrivalTerminal = segment.ArrivalTerminal,
                            FlightEquipmentIataCode = segment.FlightEquipmentIataCode,
                            ElapsedTime = segment.ElapsedTime,
                            StopsInSegment = segment.Stops ?? 0,

                            // Additional details from the appendix
                            DepartureAirportName = depAirport?.Name,
                            DepartureAirportCity = depAirport?.City,
                            DepartureAirportCountry = depAirport?.CountryName,
                            DepartureAirportTimeZone = depAirport?.TimeZoneRegionName,

                            ArrivalAirportName = arrAirport?.Name,
                            ArrivalAirportCity = arrAirport?.City,
                            ArrivalAirportCountry = arrAirport?.CountryName,
                            ArrivalAirportTimeZone = arrAirport?.TimeZoneRegionName,

                            AircraftName = equipment?.Name,
                            AircraftType = equipment?.Jet == true ? "Jet" :
                                equipment?.TurboProp == true ? "TurboProp" : "Unknown",

                            AirlineName = airline?.Name
                        };
                    })
                    .ToList();

                var flightFlightDepartureAirport = flightStatusResponse.Appendix?.Airports
                    ?.FirstOrDefault(a => a.Fs == firstFlight.DepartureAirportFsCode);
                var lastFlightArrivalAirport = flightStatusResponse.Appendix?.Airports
                    ?.FirstOrDefault(a => a.Fs == lastFlight.ArrivalAirportFsCode);

                return new FlightViewModel
                {
                    Airline = flightStatusResponse.Appendix?.Airlines
                        .FirstOrDefault(a => a.Fs == firstFlight.CarrierFsCode)
                        ?.Name,
                    AirlineCode = firstFlight.CarrierFsCode,
                    FlightNumber = firstFlight.CarrierFsCode + firstFlight.FlightNumber,
                    DepartureTime =
                        CalculateCorrectDateTimeOffset(firstFlight.DepartureTime, flightFlightDepartureAirport),
                    ArrivalTime =
                        AdjustArrivalTimeForOvernightFlight(
                            CalculateCorrectDateTimeOffset(firstFlight.DepartureTime, flightFlightDepartureAirport),
                            CalculateCorrectDateTimeOffset(lastFlight.ArrivalTime, lastFlightArrivalAirport)),
                    DepartureAirport = firstFlight.DepartureAirportFsCode,
                    ArrivalAirport = lastFlight.ArrivalAirportFsCode,
                    Duration =
                        CalculateCorrectDateTimeOffset(lastFlight.ArrivalTime, lastFlightArrivalAirport).UtcDateTime -
                        CalculateCorrectDateTimeOffset(firstFlight.DepartureTime, flightFlightDepartureAirport)
                            .UtcDateTime,
                    Stops = conn.ScheduledFlight.Count - 1, // Number of connections equals number of flights minus 1
                    Aircraft = flightStatusResponse.Appendix?.Equipments
                        .FirstOrDefault(e => e.Iata == firstFlight.FlightEquipmentIataCode)
                        ?.Name,
                    ServiceClasses = firstFlight.ServiceClasses,
                    IsCodeShare = firstFlight.IsCodeshare ?? false,
                    Amount = 0, // Will fill this in on the next step
                    CodeShareAirline = firstFlight.IsCodeshare ?? false ? firstFlight.CarrierFsCode : null,

                    // Add new properties for multi-segment support
                    IsMultiSegment = conn.ScheduledFlight.Count > 1,
                    ElapsedTime = conn.ElapsedTime ?? 0,
                    Score = conn.Score ?? 0,
                    ConnectionId = Guid.NewGuid().ToString(),
                    DepartureTimeZone = flightFlightDepartureAirport?.TimeZoneRegionName,
                    ArrivalTimeZone = lastFlightArrivalAirport?.TimeZoneRegionName,

                    // Add flight segments
                    FlightSegments = segments
                };
            });

        return flightOptions.OrderBy(flight => flight.ArrivalTime).ToList();
    }

    /// <summary>
    /// Calculates the effective start time for flight search, applying the airport's buffer time.
    /// If the requested departure time is in the past, the current tenant time is used instead
    /// to prevent showing flights that have already departed.
    /// </summary>
    private DateTime CalculateFlightSearchStartTime(DateTimeOffset? departureDateTime, int flightBuffer)
    {
        var currentTenantTime = infoService.GetCurrentTenantTime();

        // Compare using DateTime values to avoid timezone conversion issues
        // when comparing DateTimeOffset with DateTime
        DateTime effectiveStartTime;
        if (departureDateTime.HasValue && departureDateTime.Value.DateTime >= currentTenantTime)
            // Requested departure is in the future, use it
            effectiveStartTime = departureDateTime.Value.DateTime;
        else
            // No departure specified, or it's in the past, use current time
            effectiveStartTime = currentTenantTime;

        return effectiveStartTime.AddMinutes(flightBuffer);
    }

    /// <summary>
    /// Splits a DateTimeOffset into individual date/time components.
    /// </summary>
    private static (int year, int month, int day, int hour, int min) SplitDate(DateTimeOffset effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    /// <summary>
    /// Splits a flight number into carrier code (first 2 chars) and flight number.
    /// </summary>
    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);

    /// <summary>
    /// Adjusts arrival time when flight crosses midnight (overnight flight).
    /// </summary>
    private static DateTimeOffset AdjustArrivalTimeForOvernightFlight(DateTimeOffset departureTime,
        DateTimeOffset arrivalTime)
    {
        // If arrival time is earlier than departure time, it means the flight goes overnight
        if (arrivalTime.TimeOfDay < departureTime.TimeOfDay)
            return arrivalTime.AddDays(1);

        // For multi-day flights, ensure the arrival date is at least the departure date
        if (arrivalTime.Date >= departureTime.Date) return arrivalTime;
        var daysDifference = (departureTime.Date - arrivalTime.Date).Days;
        return arrivalTime.AddDays(daysDifference);
    }

    /// <summary>
    /// Converts a flight datetime string to a DateTimeOffset using the airport's timezone.
    /// </summary>
    private static DateTimeOffset CalculateCorrectDateTimeOffset(string flightDateTime, Airport airport)
    {
        // Parse the datetime string
        if (!DateTime.TryParse(flightDateTime, out var localDateTime))
            throw new ArgumentException($"Invalid datetime format: {flightDateTime}");

        // Get the timezone for the airport
        TimeZoneInfo airportTimeZone;

        try
        {
            airportTimeZone = TimeZoneInfo.FindSystemTimeZoneById(airport.TimeZoneRegionName);
        }
        catch (TimeZoneNotFoundException)
        {
            throw new ArgumentException($"Invalid timezone: {airport.TimeZoneRegionName} for airport {airport.Iata}");
        }

        // Create DateTimeOffset with the airport's timezone offset
        var unspecifiedDateTime = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
        var offset = airportTimeZone.GetUtcOffset(unspecifiedDateTime);

        return new DateTimeOffset(unspecifiedDateTime, offset);
    }
}