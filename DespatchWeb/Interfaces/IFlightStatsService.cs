using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;

namespace DespatchWeb.Interfaces;

public interface IFlightStatsService
{
    Task<List<FlightViewModel>> GetFlightsAsync(
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        DateTime? flightBuffer = null,
        string codeType = null,
        string[] extendedOptions = null);

    Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime);

    Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode);

    Task<Rule> GetAlertSubscriptionByIdAsync(string alertId);

    Task DeleteAlertByIdAsync(string alertId);
}