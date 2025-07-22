using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Interfaces;

public interface IFlightStatsService
{
    Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode, string events = null);

    Task DeleteFlightRuleById(string webhookId);

    Task<List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTime? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int? arrivalAirportId = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null,
        int minimumLayoverMinutes = 60
    );

    Task<AddFlightToJobDto> GetFlightDetailsByFlightNumberAsync(
        string completeFlightNumber,
        DateTime departureTime,
        int jobId);
}