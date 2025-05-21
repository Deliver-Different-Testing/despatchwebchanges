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
    INationwideJobRepository repository
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
            throw new Exception($"Failed to disconnect alert aler: {response.ReasonPhrase}");
    }

    public async Task<List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTime? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null,
        int minimumLayoverMinutes = 60
        )
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        Log.Information("Flight search started for job {JobId} with departure {DepartureDateTime}",
            jobId, departureDateTime);

        var (destinationAirportCode, departureAirportCode) = await repository.GetAirportCodesByJobIdAsync(jobId);
        if (departureAirportId.HasValue)
            departureAirportCode = await repository.GetSingleAirportCodeByIdAsync(departureAirportId.Value);

        var activeAirlines = await repository.GetActiveAirlineOptionsAsync();
        var activeAirlineCodes = activeAirlines.Select(x => x.Text).ToList();

        ArgumentException.ThrowIfNullOrEmpty(departureAirportCode);
        ArgumentException.ThrowIfNullOrEmpty(destinationAirportCode);

        var flightsFrom = departureDateTime;
        flightsFrom = flightsFrom?.AddMinutes(flightBuffer);

        var (year, month, day, hour, minute) = SplitDate(flightsFrom.Value);

        var relativeUrl =
            $"json/firstflightout/{departureAirportCode}/to/{destinationAirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}";

        var query = HttpUtility.ParseQueryString(string.Empty);
        query["appId"] = _appId;
        query["appKey"] = _appKey;
        query["payloadType"] = "cargo";
        query["maxResults"] = "100";
        query["includeCodeshares"] = "false";
        query["maxConnections"] = "1"; //default is 2
        query["numHours"] = "24"; //How many hours flights after the dateTime to search default are 6
        query["minimumConnectTime"] = minimumLayoverMinutes.ToString();

        // Filter by specific airline if airlineId is provided
        if (airlineId is > 0)
        {
            var selectedAirline = activeAirlines.FirstOrDefault(a => a.Id == airlineId.Value);
            if (selectedAirline != null)
            {
                var selectedAirlineCode = selectedAirline.Text;
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

        // Pre-filter connections to avoid processing unnecessary data
        var connections = flightStatusResponse.Connections;

        var flightOptions = await Task.WhenAll(connections
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

                // Map flight segments with detailed info from appendix
                var segments = conn.ScheduledFlight
                    .Select((segment, index) => {
                        var depAirport = flightStatusResponse.Appendix?.Airports
                            ?.FirstOrDefault(a => a.Fs == segment.DepartureAirportFsCode);

                        var arrAirport = flightStatusResponse.Appendix?.Airports
                            ?.FirstOrDefault(a => a.Fs == segment.ArrivalAirportFsCode);

                        var equipment = flightStatusResponse.Appendix?.Equipments
                            ?.FirstOrDefault(e => e.Iata == segment.FlightEquipmentIataCode);

                        var airline = flightStatusResponse.Appendix?.Airlines
                            ?.FirstOrDefault(a => a.Fs == segment.CarrierFsCode);

                        return new FlightSegmentViewModel
                        {
                            SegmentOrder = index,
                            CarrierFsCode = segment.CarrierFsCode,
                            FlightNumber = segment.FlightNumber,
                            DepartureTime = segment.DepartureTime,
                            ArrivalTime = segment.ArrivalTime,
                            DepartureAirportFsCode = segment.DepartureAirportFsCode,
                            DepartureTerminal = segment.DepartureTerminal,
                            ArrivalAirportFsCode = segment.ArrivalAirportFsCode,
                            ArrivalTerminal = segment.ArrivalTerminal,
                            FlightEquipmentIataCode = segment.FlightEquipmentIataCode,
                            ElapsedTime = segment.ElapsedTime,
                            StopsInSegment = segment.Stops,

                            // Additional details from appendix
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
                    CodeShareAirline = firstFlight.IsCodeShare ? firstFlight.CarrierFsCode : null,

                      // Add new properties for multi-segment support
                    IsMultiSegment = conn.ScheduledFlight.Count > 1,
                    ElapsedTime = conn.ElapsedTime,
                    Score = conn.Score,
                    ConnectionId = Guid.NewGuid().ToString(),

                    // Add flight segments
                    FlightSegments = segments
                };
            }));

        return flightOptions.OrderBy(flight => flight.DepartureTime).ToList();
    }

    public async Task<AddFlightToJobDto> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime)
    {
        var flightResponse = await FetchFlightDataAsync(completeFlightNumber, departureTime);
        if (flightResponse?.ScheduledFlights == null || flightResponse.ScheduledFlights.Count == 0)
            return null;

        return MapToFlightDto(flightResponse.ScheduledFlights.First(), flightResponse.Appendix);
    }

    private static AddFlightToJobDto MapToFlightDto(ScheduledFlight flight, Appendix appendix)
    {
      ArgumentNullException.ThrowIfNull(flight);

        return new AddFlightToJobDto
        {
            AirlineName = appendix?.Airlines?.FirstOrDefault(a => a.Fs == flight.CarrierFsCode)?.Name,
            ArrivalTime = flight.ArrivalTime,
            CarrierFsCode = flight.CarrierFsCode,
            DepartureTime = flight.DepartureTime,
            FlightNumber = flight.FlightNumber
        };
    }

    public async Task<List<FlightDetailsDialogViewModel>> GetFlightDetailByFlightNumberDetailDialog(
        string completeFlightNumber,
        DateTime departureTime)
    {
        var flightResponse = await FetchFlightDataAsync(completeFlightNumber, departureTime);

        // Map flight data to view models using LINQ
        return flightResponse.ScheduledFlights
            .Select(flight => CreateFlightViewModel(flight, flightResponse.Appendix))
            .ToList();
    }

    private static FlightDetailsDialogViewModel CreateFlightViewModel(ScheduledFlight flight, Appendix appendix)
    {
        var airline = appendix.Airlines.FirstOrDefault(a => a.Fs == flight.CarrierFsCode);
        var departureAirport = appendix.Airports.FirstOrDefault(a => a.Fs == flight.DepartureAirportFsCode);
        var arrivalAirport = appendix.Airports.FirstOrDefault(a => a.Fs == flight.ArrivalAirportFsCode);
        var equipment = appendix.Equipments.FirstOrDefault(e => e.Iata == flight.FlightEquipmentIataCode);

        return MapToViewModel(flight, airline, departureAirport, arrivalAirport, equipment, appendix);
    }

    private async Task<FlightSchedulesResponse> FetchFlightDataAsync(string completeFlightNumber,
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
        var flightResponse = JsonSerializer.Deserialize<FlightSchedulesResponse>(content);
        ArgumentNullException.ThrowIfNull(flightResponse);

        return flightResponse;
    }

    private static (int year, int month, int day, int hour, int min) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);

    private static FlightDetailsDialogViewModel MapToViewModel(
        ScheduledFlight flight,
        Airline airline,
        Airport departureAirport,
        Airport arrivalAirport,
        Equipment equipment,
        Appendix appendix)
    {
        if (flight == null) return null;

        // Create airport view models
        var origin = new AirportViewModel
        {
            Code = departureAirport?.Iata ?? "Unknown",
            Name = departureAirport?.Name ?? "Unknown Airport",
            City = departureAirport?.City ?? "Unknown",
            Country = departureAirport?.CountryName ?? "Unknown",
            Timezone = departureAirport?.TimeZoneRegionName ?? "Unknown",
            Elevation = departureAirport?.ElevationFeet ?? 0,
            Latitude = departureAirport?.Latitude ?? 0,
            Longitude = departureAirport?.Longitude ?? 0
        };

        var destination = new AirportViewModel
        {
            Code = arrivalAirport?.Iata ?? "Unknown",
            Name = arrivalAirport?.Name ?? "Unknown Airport",
            City = arrivalAirport?.City ?? "Unknown",
            Country = arrivalAirport?.CountryName ?? "Unknown",
            Timezone = arrivalAirport?.TimeZoneRegionName ?? "Unknown",
            Elevation = arrivalAirport?.ElevationFeet ?? 0,
            Latitude = arrivalAirport?.Latitude ?? 0,
            Longitude = arrivalAirport?.Longitude ?? 0
        };

        // Calculate flight duration
        var duration = flight.ArrivalTime - flight.DepartureTime;
        var hours = (int)duration.TotalHours;
        var minutes = duration.Minutes;
        var durationFormatted = $"{hours}h {minutes}m";

        // Format date/times
        var departureTimeFormatted = flight.DepartureTime.ToString("MMM d, yyyy HH:mm:ss");
        var arrivalTimeFormatted = flight.ArrivalTime.ToString("MMM d, yyyy HH:mm:ss");

        OperatorViewModel operatedBy = null;
        if (flight.Operator != null)
        {
            var operatorAirline = appendix.Airlines.FirstOrDefault(a => a.Fs == flight.Operator.CarrierFsCode);
            operatedBy = new OperatorViewModel
            {
                CarrierCode = flight.Operator.CarrierFsCode,
                FlightNumber = flight.Operator.FlightNumber,
                AirlineName = operatorAirline?.Name ?? flight.Operator.CarrierFsCode,
                ServiceType = flight.Operator.ServiceType
            };
        }

        // Create codeshare view models if available
        CodeShareViewModel[] codeShares = null;
        if (flight.CodeShares != null && flight.CodeShares.Count != 0)
        {
            codeShares = flight.CodeShares.Select(cs => new CodeShareViewModel
            {
                CarrierCode = cs.CarrierFsCode,
                FlightNumber = cs.FlightNumber,
                ServiceType = cs.ServiceType,
                ServiceClasses = cs.ServiceClasses?.ToArray() ?? []
            }).ToArray();
        }

        // Create aircraft name
        var aircraftName = equipment?.Name ?? "Unknown";
        var aircraftCode = flight.FlightEquipmentIataCode ?? "N/A";
        var aircraftFormatted = $"{aircraftName} ({aircraftCode})";

        // Build and return the view model
        return new FlightDetailsDialogViewModel
        {
            FlightNumber = flight.FlightNumber,
            CarrierCode = flight.CarrierFsCode,
            AirlineName = airline?.Name ?? flight.CarrierFsCode,
            ServiceType = flight.ServiceType,

            Origin = origin,
            Destination = destination,
            DepartureTime = departureTimeFormatted,
            ArrivalTime = arrivalTimeFormatted,
            Duration = durationFormatted,
            Stops = flight.Stops,
            IsNonStop = flight.Stops == 0,
            ArrivalTerminal = flight.ArrivalTerminal,

            Aircraft = aircraftFormatted,
            AircraftType = equipment != null
                ? equipment.Jet ? "Jet" : equipment.TurboProp ? "Turboprop" : "Other"
                : "Unknown",

            ServiceClasses = flight.ServiceClasses?.ToArray() ?? [],
            IsCodeShare = flight.IsCodeShare,
            IsWetLease = flight.IsWetLease,

            OperatedBy = operatedBy,
            CodeShares = codeShares,

            FlightId = $"{flight.CarrierFsCode}{flight.FlightNumber}",
            ReferenceCode = flight.ReferenceCode
        };
    }
}
