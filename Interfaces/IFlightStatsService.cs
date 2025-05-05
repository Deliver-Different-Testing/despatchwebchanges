using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DateTime = System.DateTime;

namespace DespatchWeb.Interfaces;

public interface IFlightStatsService
{
    Task< List<FlightViewModel>> GetFlightsAsync(
        int jobId,
        DateTime? departureDateTime = null,
        int? airlineId = null,
        int? departureAirportId = null,
        int flightBuffer = 0,
        string codeType = null,
        List<string> extendedOptions = null);

    Task<AddFlightToJobDto> GetFlightDetailsByFlightNumberAsync(string completeFlightNumber,
        DateTime departureTime);

    Task<string> CreateFlightRuleByDepartureAsync(string completeFlightNumber, DateTime departureTime,
        string departureAirportCode);

    Task<List<FlightDetailsDialogViewModel>> GetFlightDetailByFlightNumberDetailDialog(
        string completeFlightNumber, DateTime departureTime);

    Task DeleteFlightRuleById(string webhookId);
}
