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
using Microsoft.Extensions.Configuration;
using Serilog;

namespace DespatchWeb.Services;

public class FlightStatusService(HttpClient httpClient) : IFlightStatusService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");

    
    public async Task<List<FlightViewModel>> GetFlightsAsync(
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        string codeType = null,
        string[] extendedOptions = null)
    {
        if (string.IsNullOrEmpty(departureAirportCode))
            throw new ArgumentException("Departure airport code is required and cannot be null or empty.",
                nameof(departureAirportCode));

        if (string.IsNullOrEmpty(destinationAirportCode))
            throw new ArgumentException("Arrival airport code is required and cannot be null or empty.",
                nameof(destinationAirportCode));

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
            .Where(flight => flight.DepartureTime > DateTime.Now && !flight.IsCodeShare)
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

    public async Task<ScheduledFlight> GetFlightDetailsByFlightNumber(string flightNumber,
        DateTime departureTime)
    {
        if (string.IsNullOrEmpty(flightNumber))
            throw new ArgumentException("Flight number is required and cannot be null or empty.", nameof(flightNumber));

        var carrierCode = flightNumber[..2];
        var number = flightNumber[2..];
        var (year, month, day) = SplitDate(departureTime);

        
        // Construct the relative URL
        var relativeUrl = $"json/flight/{carrierCode}/{number}/departing/{year}/{month}/{day}";


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
}
