using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Configuration;

namespace DespatchWeb.Services;

public class FlightStatusService(HttpClient httpClient) : IFlightStatusService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId = Environment.GetEnvironmentVariable("FlightStatusApiAppId");
    private readonly string _appKey = Environment.GetEnvironmentVariable("FlightStatusApiAppKey");

    
    public async Task<List<FlightOptionsViewModel>> GetFlightsAsync(
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

        var year = effectiveDateTime.Year;
        var month = effectiveDateTime.Month;
        var day = effectiveDateTime.Day;

        // Construct the base URL
        var baseUrl = $"json/from/{departureAirportCode}/to/{destinationAirportCode}/departing/{year}/{month}/{day}";

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
        var uriBuilder = new UriBuilder(baseUrl) { Query = query.ToString() };
        var uri = uriBuilder.Uri;

        // Execute the request
        var response = await httpClient.GetAsync(uri);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        var flightStatusResponse = JsonSerializer.Deserialize<FlightStatusResponse>(content);

        if (flightStatusResponse?.ScheduledFlights == null)
            return new List<FlightOptionsViewModel>();

        var flightOptions = flightStatusResponse.ScheduledFlights
            .Where(flight => flight.DepartureTime > DateTime.Now)
            .Select(flight => new FlightOptionsViewModel
            {
                Airline = flightStatusResponse.Appendix?.Airlines.FirstOrDefault(a => a.Fs == flight.CarrierFsCode)?.Name,
                FlightNumber = flight.FlightNumber,
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
            }).OrderBy(f => f.DepartureTime).ToList();

        return flightOptions;
    }
}
