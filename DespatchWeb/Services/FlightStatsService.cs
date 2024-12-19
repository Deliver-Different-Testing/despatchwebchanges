using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Config;
using DespatchWeb.Models.FlightStats;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RestSharp;
using DateTime = System.DateTime;

namespace DespatchWeb.Services;

public class FlightStatsService : IFlightStatsService
{
    private const string ScheduleUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private const string ConnectionUrl = "https://api.flightstats.com/flex/connections/rest/v3/";
    private const string AlertUrl = "https://api.flightstats.com/flex/alerts/rest/v1/";
    private readonly FlightStatusConfig _flightStatusConfig;
    private readonly ILogger<FlightStatsService> _logger;

    public FlightStatsService(ILogger<FlightStatsService> logger, IOptions<FlightStatusConfig> flightStatusConfig)
    {
        _logger = logger;
        _flightStatusConfig = flightStatusConfig.Value;
        _logger.LogInformation("Initializing FlightStatsService");

        if (string.IsNullOrEmpty(_flightStatusConfig.AppId) || string.IsNullOrEmpty(_flightStatusConfig.AppKey))
        {
            _logger.LogError(
                "FlightStatsService initialization failed: AppId and/or AppKey missing from configuration");
            throw new ArgumentException("AppId and AppKey must be provided in the configuration.");
        }

        _logger.LogInformation("FlightStatsService initialized successfully");
    }

    public async Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode)
    {
        _logger.LogInformation("Creating flight rule for flight {FlightNumber} departing from {Airport} at {Time}",
            completeFlightNumber, departureAirportCode, departureTime);

        if (string.IsNullOrEmpty(departureAirportCode))
        {
            _logger.LogError("Cannot create flight rule: Departure airport code is null or empty");
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));
        }

        var alertClient = new RestClient(AlertUrl);
        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);

        var request =
            new RestRequest(
                $"json/create/{carrierCode}/{flightNumber}/from/{departureAirportCode}/departing/{year}/{month}/{day}");

        request.AddQueryParameter("appId", _flightStatusConfig.AppId);
        request.AddQueryParameter("appKey", _flightStatusConfig.AppKey);
        request.AddQueryParameter("type", "JSON");
        request.AddQueryParameter("deliverTo", _flightStatusConfig.WebhookUrl);

        _logger.LogDebug("Sending alert creation request for carrier {Carrier}, flight {Flight}", carrierCode,
            flightNumber);
        var response = await alertClient.ExecuteGetAsync<CreateAlertResponse>(request);

        if (!response.IsSuccessful || response.Data is null)
        {
            _logger.LogError("Failed to create flight rule: {ErrorMessage}", response.ErrorMessage);
            throw new Exception($"Failed to set up alert: {response.ErrorMessage}");
        }

        _logger.LogInformation("Successfully created flight rule with ID: {RuleId}", response.Data.Rule?.Id);
        return response.Data.Rule?.Id;
    }

    public async Task<List<FlightViewModel>> GetFlightsAsync(
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        List<string> includeAirlines = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null)
    {
        _logger.LogInformation("Retrieving flights from {DepartureAirport} to {ArrivalAirport}",
            departureAirportCode, destinationAirportCode);

        if (string.IsNullOrEmpty(departureAirportCode))
        {
            _logger.LogError("Cannot retrieve flights: Departure airport code is null or empty");
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));
        }

        if (string.IsNullOrEmpty(destinationAirportCode))
        {
            _logger.LogError("Cannot retrieve flights: Destination airport code is null or empty");
            throw new ArgumentException("Arrival airport code is required and cannot be null or empty.",
                nameof(destinationAirportCode));
        }

        var connectionClient = new RestClient(ConnectionUrl);

        // Get datetime to sort flights from
        var flightsFrom = departureDateTime == null || departureDateTime < DateTime.Now
            ? DateTime.Now
            : departureDateTime;
        flightsFrom = flightsFrom.Value.AddMinutes(flightBuffer);

        var (year, month, day, hour, minute) = SplitDate(flightsFrom.Value);

        var request =
            new RestRequest(
                $"json/firstflightout/{departureAirportCode}/to/{destinationAirportCode}/leaving_after/{year}/{month}/{day}/{hour}/{minute}");

        request.AddQueryParameter("appId", _flightStatusConfig.AppId);
        request.AddQueryParameter("appKey", _flightStatusConfig.AppKey);
        request.AddQueryParameter("payloadType", "cargo");
        request.AddQueryParameter("maxResults", 100);
        request.AddQueryParameter("includeCodeshares", false);

        if (includeAirlines != null && includeAirlines.Any())
        {
            var combinedAirlines = string.Join(",", includeAirlines);
            _logger.LogDebug("Adding carrier filters: {Carriers}", combinedAirlines);
            request.AddQueryParameter("includeAirlines", combinedAirlines);
        }

        if (!string.IsNullOrEmpty(codeType))
        {
            _logger.LogDebug("Adding code type parameter: {CodeType}", codeType);
            request.AddQueryParameter("codeType", codeType);
        }

        if (extendedOptions != null && extendedOptions.Any())
        {
            var combinedOptions = string.Join(",", extendedOptions);
            _logger.LogDebug("Adding extended options: {Options}", combinedOptions);
            request.AddQueryParameter("extendedOptions", combinedOptions);
        }

        _logger.LogDebug("Executing flight search request to {Url}", request.Resource);
        var response = await connectionClient.ExecuteGetAsync<FlightConnectionsResponse>(request);

        if (response.Data?.Connections == null)
        {
            _logger.LogWarning("No flights found for the specified route and time");
            return new List<FlightViewModel>();
        }

        var flightOptions = response.Data.Connections
            .Where(conn => conn.ScheduledFlight.Any())
            .Select(conn =>
            {
                var firstFlight = conn.ScheduledFlight.First();
                var lastFlight = conn.ScheduledFlight.Last();

                return new FlightViewModel
                {
                    Airline = response.Data.Appendix?.Airlines.FirstOrDefault(a => a.Fs == firstFlight.CarrierFsCode)
                        ?.Name,
                    FlightNumber = firstFlight.CarrierFsCode + firstFlight.FlightNumber,
                    DepartureTime = firstFlight.DepartureTime,
                    ArrivalTime = lastFlight.ArrivalTime,
                    DepartureAirport = firstFlight.DepartureAirportFsCode,
                    ArrivalAirport = lastFlight.ArrivalAirportFsCode,
                    Duration = lastFlight.ArrivalTime - firstFlight.DepartureTime,
                    Stops = conn.ScheduledFlight.Count - 1,
                    Aircraft = response.Data.Appendix?.Equipments
                        .FirstOrDefault(e => e.Iata == firstFlight.FlightEquipmentIataCode)
                        ?.Name,
                    ServiceClasses = firstFlight.ServiceClasses,
                    IsCodeShare = firstFlight.IsCodeshare,
                    CodeShareAirline = firstFlight.IsCodeshare ? firstFlight.CarrierFsCode : null
                };
            }).OrderBy(flight => flight.DepartureTime).ToList();

        _logger.LogInformation("Retrieved {Count} flights for route {DepartureAirport} to {ArrivalAirport}",
            flightOptions.Count, departureAirportCode, destinationAirportCode);

        return flightOptions;
    }

    public async Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime)
    {
        _logger.LogInformation("Retrieving details for flight {FlightNumber} departing at {Time}",
            completeFlightNumber, departureTime);

        if (string.IsNullOrEmpty(completeFlightNumber))
        {
            _logger.LogError("Cannot retrieve flight details: Flight number is null or empty");
            throw new ArgumentException("Flight number is required and cannot be null or empty.",
                nameof(completeFlightNumber));
        }

        var scheduleClient = new RestClient(ScheduleUrl);
        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);
        var (year, month, day, _, _) = SplitDate(departureTime);

        var request = new RestRequest($"json/flight/{carrierCode}/{flightNumber}/departing/{year}/{month}/{day}");
        request.AddQueryParameter("appId", _flightStatusConfig.AppId);
        request.AddQueryParameter("appKey", _flightStatusConfig.AppKey);

        _logger.LogDebug("Executing flight details request for carrier {Carrier}, flight {Flight}",
            carrierCode, flightNumber);
        var response = await scheduleClient.ExecuteGetAsync<FlightSchedulesResponse>(request);

        if (!response.IsSuccessful)
        {
            _logger.LogError("Failed to retrieve flight details: {ErrorMessage}", response.ErrorMessage);
            throw new Exception($"Failed to retrieve flight information: {response.ErrorMessage}");
        }

        var flight = response.Data.ScheduledFlights.FirstOrDefault();
        _logger.LogInformation("Retrieved details for flight {FlightNumber}", completeFlightNumber);

        return flight;
    }

    public async Task<Rule> GetAlertSubscriptionByIdAsync(string alertId)
    {
        _logger.LogInformation("Retrieving alert subscription for ID: {AlertId}", alertId);

        var alertClient = new RestClient(AlertUrl);
        var request = new RestRequest($"json/get/{alertId}");
        request.AddQueryParameter("appId", _flightStatusConfig.AppId);
        request.AddQueryParameter("appKey", _flightStatusConfig.AppKey);

        var response = await alertClient.ExecuteGetAsync<RetrieveAlertResponse>(request);

        if (!response.IsSuccessful || response.Data is null)
        {
            _logger.LogError("Failed to retrieve alert subscription: {ErrorMessage}", response.ErrorMessage);
            throw new Exception($"Failed to retrieve alert information: {response.ErrorMessage}");
        }

        _logger.LogInformation("Successfully retrieved alert subscription for ID: {AlertId}", alertId);
        return response.Data.Rule;
    }

    public async Task DeleteAlertByIdAsync(string alertId)
    {
        _logger.LogInformation("Deleting alert with ID: {AlertId}", alertId);

        var alertClient = new RestClient(AlertUrl);
        var request = new RestRequest($"json/delete/{alertId}");
        request.AddQueryParameter("appId", _flightStatusConfig.AppId);
        request.AddQueryParameter("appKey", _flightStatusConfig.AppKey);

        var response = await alertClient.ExecuteGetAsync(request);

        if (!response.IsSuccessful)
        {
            _logger.LogError("Failed to delete alert: {ErrorMessage}", response.ErrorMessage);
            throw new Exception($"Failed to retrieve alert information: {response.ErrorMessage}");
        }

        _logger.LogInformation("Successfully deleted alert with ID: {AlertId}", alertId);
    }

    private static (int year, int month, int day, int hour, int min) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day, effectiveDateTime.Hour,
            effectiveDateTime.Minute);

    private static (string carrierCode, string flightNumber) SplitFlightCode(string completeFlightNumber) =>
        (completeFlightNumber?[..2], completeFlightNumber?[2..]);
}
