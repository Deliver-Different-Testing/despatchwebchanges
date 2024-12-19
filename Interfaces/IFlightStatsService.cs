using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;
using DateTime = System.DateTime;

namespace DespatchWeb.Interfaces;

public interface IFlightStatsService
{
    Task<List<FlightViewModel>> GetFlightsAsync(
        string departureAirportCode,
        string destinationAirportCode,
        DateTime? departureDateTime = null,
        List<string> includeAirlines = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null);

    Task<ScheduledFlight> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime);

    Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode);
}
