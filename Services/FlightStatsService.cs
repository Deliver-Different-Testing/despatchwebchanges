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
using DespatchWeb.Models.Dto;
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

    public async Task<List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTime? departureDateTime = null,
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
        var (departureAirport, arrivalAirport) =
            await repository.GetArrivalAndDepartureAirports(jobId, departureAirportId, arrivalAirportId);
        ArgumentNullException.ThrowIfNull(departureAirport);
        ArgumentNullException.ThrowIfNull(arrivalAirport);
        
        var activeAirlineCodes = await repository.GetActiveAirlineCodesAsync();
        
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
            ArgumentNullException.ThrowIfNull(selectedAirline);

            Log.Debug("Filtering FlightWebhooks by specific airline: {Carrier}", selectedAirline);
            query["includeAirlines"] = selectedAirline;
        }
        else if (activeAirlineCodes.Count != 0)
        {
            var combinedAirlines = string.Join(",", activeAirlineCodes);
            Log.Debug("Filtering FlightWebhooks by carrier filters: {Carriers}", combinedAirlines);
            query["includeAirlines"] = combinedAirlines;
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
        var flightStatusResponse = JsonSerializer.Deserialize<FlightConnectionsResponse>(content);
        ArgumentNullException.ThrowIfNull(flightStatusResponse);

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
                            ?.FirstOrDefault(a => a.Fs == segment.CarrierFsCode && activeAirlineCodes.Contains(segment.CarrierFsCode));

                        return new FlightSegmentViewModel
                        {
                            SegmentOrder = index,
                            CarrierFsCode = segment.CarrierFsCode,
                            FlightNumber = segment.FlightNumber,
                            DepartureTime = segment.DepartureTime,
                            ArrivalTime =
                                AdjustArrivalTimeForOvernightFlight(segment.DepartureTime, segment.ArrivalTime),
                            DepartureAirportId = departureAirport.AirportId,
                            DepartureAirportFsCode = segment.DepartureAirportFsCode,
                            DepartureTerminal = segment.DepartureTerminal,
                            ArrivalAirportId = arrivalAirport.AirportId,
                            ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                            ArrivalTerminal = segment.ArrivalTerminal,
                            FlightEquipmentIataCode = segment.FlightEquipmentIataCode,
                            ElapsedTime = segment.ElapsedTime,
                            StopsInSegment = segment.Stops,

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

                return new FlightViewModel
                {
                    Airline = flightStatusResponse.Appendix?.Airlines
                        .FirstOrDefault(a => a.Fs == firstFlight.CarrierFsCode)
                        ?.Name,
                    AirlineCode = firstFlight.CarrierFsCode,
                    FlightNumber = firstFlight.CarrierFsCode + firstFlight.FlightNumber,
                    DepartureTime = firstFlight.DepartureTime,
                    ArrivalTime =
                        AdjustArrivalTimeForOvernightFlight(firstFlight.DepartureTime, lastFlight.ArrivalTime),
                    DepartureAirport = firstFlight.DepartureAirportFsCode,
                    ArrivalAirport = lastFlight.ArrivalAirportFsCode,
                    Duration = lastFlight.ArrivalTime - firstFlight.DepartureTime,
                    Stops = conn.ScheduledFlight.Count - 1, // Number of connections equals number of flights minus 1
                    Aircraft = flightStatusResponse.Appendix?.Equipments
                        .FirstOrDefault(e => e.Iata == firstFlight.FlightEquipmentIataCode)
                        ?.Name,
                    ServiceClasses = firstFlight.ServiceClasses,
                    IsCodeShare = firstFlight.IsCodeShare,
                    Amount = 0, // Will fill this in on the next step
                    CodeShareAirline = firstFlight.IsCodeShare ? firstFlight.CarrierFsCode : null,

                    // Add new properties for multi-segment support
                    IsMultiSegment = conn.ScheduledFlight.Count > 1,
                    ElapsedTime = conn.ElapsedTime,
                    Score = conn.Score,
                    ConnectionId = Guid.NewGuid().ToString(),

                    // Add flight segments
                    FlightSegments = segments
                };
            });

        return flightOptions.OrderBy(flight => flight.DepartureTime).ToList();
    }

    private DateTime CalculateFlightSearchStartTime(DateTime? departureDateTime, int flightBuffer)
    {
        var currentTenantTime = infoService.GetCurrentTenantTime();
        var effectiveStartTime = (departureDateTime < currentTenantTime ? currentTenantTime : departureDateTime) ??
                                 currentTenantTime;
        var flightsFrom = effectiveStartTime.AddMinutes(flightBuffer);

        ArgumentNullException.ThrowIfNull(flightsFrom);
        return flightsFrom;
    }

    public async Task<AddFlightToJobDto> GetFlightDetailsByFlightNumberAsync(
        string completeFlightNumber,
        DateTime departureTime,
        int jobId)
    {
        ArgumentException.ThrowIfNullOrEmpty(completeFlightNumber);

        // Get the route information from the job
        var (destinationAirportCode, departureAirportCode) = await repository.GetAirportCodesByJobIdAsync(jobId);

        ArgumentException.ThrowIfNullOrEmpty(departureAirportCode);
        ArgumentException.ThrowIfNullOrEmpty(destinationAirportCode);

        var (year, month, day, hour, minute) = SplitDate(departureTime);

        var relativeUrl =
            $"json/firstflightout/{departureAirportCode}/to/{destinationAirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["payloadType"] = "cargo";
        query["maxResults"] = "100"; // Increase to ensure we find the specific flight
        query["includeCodeshares"] = "false";
        query["maxConnections"] = "1";
        query["numHours"] = "24";

        var fullUrl = $"{ConnectionsBaseUrl.TrimEnd('/')}/{relativeUrl.TrimStart('/')}";
        var uriBuilder = new UriBuilder(fullUrl)
        {
            Query = query.ToString() ?? string.Empty
        };

        var uri = uriBuilder.Uri;
        Log.Debug("FlightRequest for details: {Uri}", uri);

        var response = await httpClient.GetAsync(uri);
        if (!response.IsSuccessStatusCode)
            throw new Exception($"Failed to retrieve flight information: {response.ReasonPhrase}");

        var content = await response.Content.ReadAsStringAsync();
        var flightResponse = JsonSerializer.Deserialize<FlightConnectionsResponse>(content);

        if (flightResponse?.Connections == null)
            return null;

        // Find the specific flight by matching the flight number in any segment
        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);

        var matchingConnection = flightResponse.Connections
            .FirstOrDefault(conn =>
                conn.ScheduledFlight.Any(sf =>
                    sf.CarrierFsCode == carrierCode &&
                    sf.FlightNumber == flightNumber));

        if (matchingConnection == null)
        {
            Log.Warning("Flight {FlightNumber} not found in connections for route {Departure} -> {Arrival} on {Date}",
                completeFlightNumber, departureAirportCode, destinationAirportCode, departureTime);
            return null;
        }

        var firstFlight = matchingConnection.ScheduledFlight.First();
        var lastFlight = matchingConnection.ScheduledFlight.Last();

        // Extract all flight segments (same logic as GetFlightsAsync)
        var segments = matchingConnection.ScheduledFlight
            .Select((segment, index) =>
            {
                var depAirport = flightResponse.Appendix?.Airports
                    ?.FirstOrDefault(a => a.Fs == segment.DepartureAirportFsCode);

                var arrAirport = flightResponse.Appendix?.Airports
                    ?.FirstOrDefault(a => a.Fs == segment.ArrivalAirportFsCode);

                var equipment = flightResponse.Appendix?.Equipments
                    ?.FirstOrDefault(e => e.Iata == segment.FlightEquipmentIataCode);

                var airline = flightResponse.Appendix?.Airlines
                    ?.FirstOrDefault(a => a.Fs == segment.CarrierFsCode);

                return new FlightSegmentViewModel
                {
                    SegmentOrder = index,
                    CarrierFsCode = segment.CarrierFsCode,
                    FlightNumber = segment.FlightNumber,
                    DepartureTime = segment.DepartureTime,
                    ArrivalTime = AdjustArrivalTimeForOvernightFlight(segment.DepartureTime, segment.ArrivalTime),
                    DepartureAirportFsCode = segment.DepartureAirportFsCode,
                    DepartureTerminal = segment.DepartureTerminal,
                    ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                    ArrivalTerminal = segment.ArrivalTerminal,
                    FlightEquipmentIataCode = segment.FlightEquipmentIataCode,
                    ElapsedTime = segment.ElapsedTime,
                    StopsInSegment = segment.Stops,

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

        return new AddFlightToJobDto
        {
            AirlineName = flightResponse.Appendix?.Airlines?.FirstOrDefault(a => a.Fs == firstFlight.CarrierFsCode)
                ?.Name,
            ArrivalTime = AdjustArrivalTimeForOvernightFlight(firstFlight.DepartureTime, lastFlight.ArrivalTime),
            CarrierFsCode = firstFlight.CarrierFsCode,
            DepartureTime = firstFlight.DepartureTime,
            FlightNumber = firstFlight.FlightNumber,
            FlightSegments = segments
        };
    }

    private static (int year, int month, int day, int hour, int min) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);

    private static DateTime AdjustArrivalTimeForOvernightFlight(DateTime departureTime, DateTime arrivalTime)
    {
        // If arrival time is earlier than departure time, it means the flight goes overnight
        if (arrivalTime.TimeOfDay < departureTime.TimeOfDay)
            return arrivalTime.AddDays(1);

        // For multi-day flights, ensure the arrival date is at least the departure date
        if (arrivalTime.Date >= departureTime.Date) return arrivalTime;
        var daysDifference = (departureTime.Date - arrivalTime.Date).Days;
        return arrivalTime.AddDays(daysDifference);
    }
}