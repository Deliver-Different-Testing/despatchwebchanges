using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IFlightStatsService
{
    Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTimeOffset departureTime,
        string departureAirportCode);

    Task DeleteFlightRuleById(string webhookId);

    Task<IReadOnlyList<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTimeOffset? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int? arrivalAirportId = null,
        string codeType = null,
        IReadOnlyList<string> extendedOptions = null,
        int minimumLayoverMinutes = 60
    );
}