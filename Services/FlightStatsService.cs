using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto.Cirium;

namespace DespatchWeb.Services;

/// <summary>
/// Flight search and flight-alert management. All Cirium (FlightStats) calls are owned by the
/// Integration Manager gateway; this service delegates to <see cref="ICiriumApiClient"/> and maps
/// IM's transport DTOs to DespatchWeb view models. DespatchWeb no longer calls Cirium directly.
/// </summary>
public sealed class FlightStatsService(
    IHttpContextAccessor contextAccessor,
    INationwideJobRepository repository,
    ITenantClock clock,
    ICiriumApiClient ciriumApiClient
) : IFlightStatsService
{
    /// <summary>
    /// Searches for available flights between airports via the Integration Manager Cirium gateway.
    /// </summary>
    /// <param name="jobId">The job ID for logging purposes.</param>
    /// <param name="departureDateTime">The desired departure date/time.</param>
    /// <param name="airlineId">Optional specific airline ID to filter by.</param>
    /// <param name="departureAirportId">The departure airport ID.</param>
    /// <param name="arrivalAirportId">The arrival airport ID.</param>
    /// <param name="codeType">Optional code type filter.</param>
    /// <param name="extendedOptions">Optional extended search options.</param>
    /// <param name="minimumLayoverMinutes">Minimum layover time for connecting flights (default 60 minutes).</param>
    /// <param name="allowNearbyDepartures">When true, also searches airports near the departure airport.</param>
    /// <param name="allowNearbyArrivals">When true, also searches airports near the arrival airport.</param>
    /// <returns>A list of available flight options sorted by arrival time.</returns>
    public async Task<IReadOnlyList<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTimeOffset? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int? arrivalAirportId = null,
        string codeType = null,
        IReadOnlyList<string> extendedOptions = null,
        int minimumLayoverMinutes = 60,
        bool allowNearbyDepartures = false,
        bool allowNearbyArrivals = false
    )
    {
        var request = new CiriumFlightSearchRequestDto
        {
            JobId = jobId,
            DepartureDateTime = departureDateTime,
            TenantNow = clock.TenantNow,
            AirlineId = airlineId,
            DepartureAirportId = departureAirportId,
            ArrivalAirportId = arrivalAirportId,
            CodeType = codeType,
            ExtendedOptions = extendedOptions,
            MinimumLayoverMinutes = minimumLayoverMinutes,
            AllowNearbyDepartures = allowNearbyDepartures,
            AllowNearbyArrivals = allowNearbyArrivals
        };

        var response = await ciriumApiClient.SearchFlightsAsync(request);
        return response.Flights.Select(MapToViewModel).ToList();
    }

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

        // DespatchWeb mints the deliverTo token (it carries the tenant claims IM's webhook receiver
        // validates). IM owns the callback URL — it fills deliverTo with its own webhook-receiver
        // endpoint, so DespatchWeb no longer sends a URL.
        var connectionString =
            contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "Connection")?.Value;
        var tenantId = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "CurrentTenantID")?.Value;
        var timeZone = contextAccessor.HttpContext?.User.Claims.FirstOrDefault(x => x.Type == "TimeZone")?.Value;
        var userName = contextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Name)?.Value;

        ArgumentException.ThrowIfNullOrEmpty(connectionString);
        ArgumentException.ThrowIfNullOrEmpty(tenantId);

        var token = AuthenticationExtensions.CreateApiToken(userName, int.Parse(tenantId), connectionString, timeZone);
        var requestToken = new JwtSecurityTokenHandler().WriteToken(token);
        var events = await repository.GetWebhookEventsAsStringAsync();

        return await ciriumApiClient.CreateAlertAsync(new CiriumCreateAlertRequestDto
        {
            CompleteFlightNumber = completeFlightNumber,
            DepartureTime = departureTime,
            DepartureAirportCode = departureAirportCode,
            DeliverToToken = requestToken,
            Events = events
        });
    }

    /// <summary>
    /// Deletes an existing flight alert rule by its ID.
    /// </summary>
    /// <param name="webhookId">The ID of the flight rule/webhook to delete.</param>
    public async Task DeleteFlightRuleById(string webhookId)
    {
        if (string.IsNullOrEmpty(webhookId))
        {
            return;
        }

        await ciriumApiClient.DeleteAlertAsync(webhookId);
    }

    /// <summary>
    /// Checks whether a flight alert rule is still active via the Integration Manager Cirium gateway.
    /// </summary>
    /// <param name="webhookId">The ID of the flight rule/webhook to check.</param>
    /// <returns>True if the rule exists and is active; false otherwise.</returns>
    public async Task<bool> IsFlightRuleActiveAsync(string webhookId)
    {
        if (string.IsNullOrEmpty(webhookId))
        {
            return false;
        }

        return await ciriumApiClient.IsAlertActiveAsync(webhookId);
    }

    private static FlightViewModel MapToViewModel(CiriumFlightDto dto) => new()
    {
        Airline = dto.Airline,
        AirlineCode = dto.AirlineCode,
        FlightNumber = dto.FlightNumber,
        DepartureTime = dto.DepartureTime,
        ArrivalTime = dto.ArrivalTime,
        DepartureAirport = dto.DepartureAirport,
        ArrivalAirport = dto.ArrivalAirport,
        Duration = dto.Duration,
        Stops = dto.Stops,
        Aircraft = dto.Aircraft,
        ServiceClasses = dto.ServiceClasses,
        IsCodeShare = dto.IsCodeShare,
        ServiceType = dto.ServiceType,
        IsCharter = dto.IsCharter,
        ServiceTypeDescription = dto.ServiceTypeDescription,
        Amount = 0, // filled in by NationwideJobController via the flight rate service
        CodeShareAirline = dto.CodeShareAirline,
        IsMultiSegment = dto.IsMultiSegment,
        ElapsedTime = dto.ElapsedTime,
        Score = dto.Score,
        ConnectionId = dto.ConnectionId,
        DepartureTimeZone = dto.DepartureTimeZone,
        ArrivalTimeZone = dto.ArrivalTimeZone,
        FlightSegments = dto.FlightSegments.Select(MapSegment).ToList()
    };

    private static FlightSegmentViewModel MapSegment(CiriumFlightSegmentDto s) => new()
    {
        SegmentOrder = s.SegmentOrder,
        CarrierFsCode = s.CarrierFsCode,
        FlightNumber = s.FlightNumber,
        ServiceType = s.ServiceType,
        DepartureTime = s.DepartureTime,
        ArrivalTime = s.ArrivalTime,
        DepartureAirportId = s.DepartureAirportId,
        DepartureAirportFsCode = s.DepartureAirportFsCode,
        DepartureTerminal = s.DepartureTerminal,
        ArrivalAirportId = s.ArrivalAirportId,
        ArrivalAirportFsCode = s.ArrivalAirportFsCode,
        ArrivalTerminal = s.ArrivalTerminal,
        FlightEquipmentIataCode = s.FlightEquipmentIataCode,
        ElapsedTime = s.ElapsedTime,
        StopsInSegment = s.StopsInSegment,
        DepartureAirportName = s.DepartureAirportName,
        DepartureAirportCity = s.DepartureAirportCity,
        DepartureAirportCountry = s.DepartureAirportCountry,
        DepartureAirportTimeZone = s.DepartureAirportTimeZone,
        ArrivalAirportName = s.ArrivalAirportName,
        ArrivalAirportCity = s.ArrivalAirportCity,
        ArrivalAirportCountry = s.ArrivalAirportCountry,
        ArrivalAirportTimeZone = s.ArrivalAirportTimeZone,
        AircraftName = s.AircraftName,
        AircraftType = s.AircraftType,
        AirlineName = s.AirlineName
    };
}
