using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.Extensions.Configuration;
using RestSharp;

namespace DespatchWeb.Services;

public class FlightStatusService : IFlightStatusService
{
    private const string BaseUrl = "https://api.flightstats.com/flex/schedules/rest/v1";
    private readonly string _appId;
    private readonly string _appKey;
    private readonly RestClient _client;

    public FlightStatusService(IConfiguration configuration)
    {
        _appId = configuration?["FlightStatusApiKeys:AppId"];
        _appKey = configuration?["FlightStatusApiKeys:AppKey"];
        _client = new RestClient(BaseUrl);

        if (string.IsNullOrEmpty(_appId) || string.IsNullOrEmpty(_appKey))
            throw new ArgumentException("AppId and AppKey must be provided in the configuration.");
    }

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

        var request =
            new RestRequest(
                $"json/from/{departureAirportCode}/to/{destinationAirportCode}/departing/{year}/{month}/{day}");

        // Add query parameters
        request.AddQueryParameter("appId", _appId);
        request.AddQueryParameter("appKey", _appKey);
        request.AddQueryParameter("numHours", "24"); // Request 24 hours of flight data

        if (!string.IsNullOrEmpty(codeType)) request.AddQueryParameter("codeType", codeType);

        if (extendedOptions is { Length: > 0 })
            foreach (var option in extendedOptions)
                request.AddQueryParameter("extendedOptions", option);

        // Execute the request
        var response = await _client.ExecuteGetAsync<FlightSchedulesResponse>(request);

        if (response.Data?.ScheduledFlights == null)
            return new List<FlightViewModel>();

        var flightOptions = response.Data.ScheduledFlights
            //.Where(flight => flight.DepartureTime > DateTime.Now && !flight.IsCodeShare)
            .Select(flight => new FlightViewModel
            {
                Airline = response.Data.Appendix?.Airlines.FirstOrDefault(a => a.Fs == flight.CarrierFsCode)?.Name,
                FlightNumber = flight.CarrierFsCode + flight.FlightNumber,
                DepartureTime = flight.DepartureTime,
                ArrivalTime = flight.ArrivalTime,
                DepartureAirport = flight.DepartureAirportFsCode,
                ArrivalAirport = flight.ArrivalAirportFsCode,
                Duration = flight.ArrivalTime - flight.DepartureTime,
                Stops = flight.Stops,
                Aircraft = response.Data.Appendix?.Equipments
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

        var request = new RestRequest($"json/flight/{carrierCode}/{number}/departing/{year}/{month}/{day}");

        // Add query parameters
        request.AddQueryParameter("appId", _appId);
        request.AddQueryParameter("appKey", _appKey);

        // Execute the request
        var response = await _client.ExecuteGetAsync<FlightSchedulesResponse>(request);

        if (!response.IsSuccessful)
            throw new Exception($"Failed to retrieve flight information: {response.ErrorMessage}");

        return response.Data.ScheduledFlights.FirstOrDefault();
    }

    private static (int year, int month, int day) SplitDate(DateTime effectiveDateTime) =>
        (effectiveDateTime.Year, effectiveDateTime.Month, effectiveDateTime.Day);
}