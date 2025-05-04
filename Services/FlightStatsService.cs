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
        int? departureAirportId = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null)
    {
        // Return test data when debugging
        if (System.Diagnostics.Debugger.IsAttached)
        {
            return GetTestFlights();
        }

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
        query["maxResults"] = "100";
        query["includeCodeshares"] = "false";
        query["maxConnections"] = "1";

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

        if (flightStatusResponse?.Connections == null)
        {
            Log.Warning("No connections found for flight search");
            return [];
        }

        // Pre-filter connections to avoid processing unnecessary data
        var connections = flightStatusResponse.Connections;

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
        var flightResponse = await FetchFlightDataAsync(completeFlightNumber, departureTime);
        return flightResponse.ScheduledFlights.FirstOrDefault();
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
        // Return dummy data if in debug mode
        if (System.Diagnostics.Debugger.IsAttached)
        {
            return CreateDummyFlightData(completeFlightNumber, departureTime);
        }

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

    #region Test Data

    private static List<FlightViewModel> GetTestFlights()
    {
        Log.Information("Returning test flight data for debugging");

        // Create a list of test flights
        var testFlights = new List<FlightViewModel>();
        var now = DateTime.Now;

        var airlines = new[] { "Delta Air Lines", "American Airlines", "United Airlines", "Lufthansa", "Emirates" };
        var airlineCodes = new[] { "DL", "AA", "UA", "LH", "EK" };
        var airlineIds = new[] { 1, 2, 3, 4, 5 };
        var departureAirports = new[] { "JFK", "LAX", "ORD", "LHR", "DXB" };
        var arrivalAirports = new[] { "LHR", "SFO", "FRA", "JFK", "SYD" };
        var aircrafts = new[]
            { "Boeing 787-9", "Airbus A350-900", "Boeing 777-300ER", "Airbus A330-300", "Boeing 747-8" };
        var timeZones = new[]
            { "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Dubai" };

        // Generate 50 test flights
        for (var i = 0; i < 50; i++)
        {
            var airlineIndex = i % 5;
            var departureTime = now.AddHours(i + 1);
            var flightDuration = TimeSpan.FromHours(3 + i % 5);

            testFlights.Add(new FlightViewModel
            {
                Airline = airlines[airlineIndex],
                FlightNumber = airlineCodes[airlineIndex] + (100 + i),
                DepartureTime = departureTime,
                ArrivalTime = departureTime.Add(flightDuration),
                DepartureAirport = departureAirports[i % 5],
                ArrivalAirport = arrivalAirports[i % 5],
                Duration = flightDuration,
                Stops = i % 3,
                Aircraft = aircrafts[i % 5],
                ServiceClasses = ["ECONOMY", "BUSINESS"],
                IsCodeShare = i % 7 == 0,
                Amount = 100m + i * 10,
                CodeShareAirline = i % 7 == 0 ? airlineCodes[(i + 1) % 5] : null,
                AirlineId = airlineIds[airlineIndex],
                DepartureTimeZone = timeZones[i % 5],
                ArrivalTimeZone = timeZones[(i + 2) % 5]
            });
        }

        // Order by departure time and return all flights
        return testFlights.OrderBy(f => f.DepartureTime).ToList();
    }

    private static FlightSchedulesResponse CreateDummyFlightData(string completeFlightNumber, DateTime departureTime)
    {
        var (carrierCode, flightNumber) = SplitFlightCode(completeFlightNumber);

        var airports = new List<Airport>
        {
            new()
            {
                Fs = "LHR",
                Iata = "LHR",
                Name = "London Heathrow Airport",
                City = "London",
                CountryCode = "GB",
                CountryName = "United Kingdom",
                LocalTime = departureTime
            },
            new()
            {
                Fs = "JFK",
                Iata = "JFK",
                Name = "John F. Kennedy International Airport",
                City = "New York",
                CountryCode = "US",
                CountryName = "United States",
                LocalTime = departureTime.AddHours(-5) // EST time difference
            },
            new()
            {
                Fs = "LAX",
                Iata = "LAX",
                Name = "Los Angeles International Airport",
                City = "Los Angeles",
                CountryCode = "US",
                CountryName = "United States",
                LocalTime = departureTime.AddHours(-8) // PST time difference
            },
            new()
            {
                Fs = "SFO",
                Iata = "SFO",
                Name = "San Francisco International Airport",
                City = "San Francisco",
                CountryCode = "US",
                CountryName = "United States",
                LocalTime = departureTime.AddHours(-8) // PST time difference
            }
        };

        // Create dummy airlines
        var airlines = new List<Airline>
        {
            new()
            {
                Fs = "BA",
                Iata = "BA",
                Name = "British Airways",
                Active = true
            },
            new()
            {
                Fs = "AA",
                Iata = "AA",
                Name = "American Airlines",
                Active = true
            },
            new()
            {
                Fs = "UA",
                Iata = "UA",
                Name = "United Airlines",
                Active = true
            }
        };

        // Create dummy equipment
        var equipment = new List<Equipment>
        {
            new()
            {
                Iata = "77W",
                Name = "Boeing 777-300ER",
                Jet = true,
                Widebody = true
            },
            new()
            {
                Iata = "788",
                Name = "Boeing 787-8 Dreamliner",
                Jet = true,
                Widebody = true
            },
            new()
            {
                Iata = "32A",
                Name = "Airbus A320",
                Jet = true,
                Widebody = false
            }
        };

        // Create scheduled flights
        var scheduledFlights = new List<ScheduledFlight>
        {
            // Direct flight
            new()
            {
                CarrierFsCode = carrierCode,
                FlightNumber = flightNumber,
                DepartureAirportFsCode = "LHR",
                ArrivalAirportFsCode = "JFK",
                DepartureTime = departureTime,
                ArrivalTime = departureTime.AddHours(8),
                Stops = 0,
                FlightEquipmentIataCode = "77W",
                IsCodeShare = false,
                ServiceType = "J",
                ServiceClasses = ["F", "J", "Y"],
                ReferenceCode = "12345"
            },

            // Connection flight 1 - Option 1 (via LAX)
            new()
            {
                CarrierFsCode = carrierCode,
                FlightNumber = "123",
                DepartureAirportFsCode = "LHR",
                ArrivalAirportFsCode = "LAX",
                DepartureTime = departureTime.AddHours(1),
                ArrivalTime = departureTime.AddHours(12),
                Stops = 0,
                FlightEquipmentIataCode = "788",
                IsCodeShare = false,
                ServiceType = "J",
                ServiceClasses = ["F", "J", "Y"],
                ReferenceCode = "23456"
            },

            // Connection flight 2 - Option 1 (LAX to JFK)
            new()
            {
                CarrierFsCode = "AA",
                FlightNumber = "456",
                DepartureAirportFsCode = "LAX",
                ArrivalAirportFsCode = "JFK",
                DepartureTime = departureTime.AddHours(14), // 2 hour layover
                ArrivalTime = departureTime.AddHours(22),
                Stops = 0,
                FlightEquipmentIataCode = "32A",
                IsCodeShare = true,
                ServiceType = "J",
                ServiceClasses = ["J", "Y"],
                ReferenceCode = "34567"
            },

            // Connection flight 1 - Option 2 (via SFO)
            new()
            {
                CarrierFsCode = "UA",
                FlightNumber = "789",
                DepartureAirportFsCode = "LHR",
                ArrivalAirportFsCode = "SFO",
                DepartureTime = departureTime.AddHours(2),
                ArrivalTime = departureTime.AddHours(13),
                Stops = 0,
                FlightEquipmentIataCode = "788",
                IsCodeShare = false,
                ServiceType = "J",
                ServiceClasses = ["F", "J", "Y"],
                ReferenceCode = "45678"
            },

            // Connection flight 2 - Option 2 (SFO to JFK)
            new()
            {
                CarrierFsCode = "UA",
                FlightNumber = "101",
                DepartureAirportFsCode = "SFO",
                ArrivalAirportFsCode = "JFK",
                DepartureTime = departureTime.AddHours(15), // 2 hour layover
                ArrivalTime = departureTime.AddHours(23),
                Stops = 0,
                FlightEquipmentIataCode = "32A",
                IsCodeShare = false,
                ServiceType = "J",
                ServiceClasses = ["J", "Y"],
                ReferenceCode = "56789"
            }
        };

        // Create appendix
        var appendix = new Appendix
        {
            Airlines = airlines,
            Airports = airports,
            Equipments = equipment
        };

        // Create request
        var request = new Request
        {
            Endpoint = "schedules",
            Departure = new Departure
            {
                Requested = departureTime.ToString("yyyy-MM-dd"),
                Interpreted = departureTime.ToString("yyyy-MM-dd")
            },
            Arrival = new Arrival
            {
                Requested = "JFK",
                Interpreted = "JFK"
            },
            MaxConnections = new MaxConnections
            {
                Requested = "1",
                Interpreted = 1
            }
        };

        // Create and return flight response
        return new FlightSchedulesResponse
        {
            Request = request,
            ScheduledFlights = scheduledFlights,
            Appendix = appendix
        };
    }

    #endregion
}
