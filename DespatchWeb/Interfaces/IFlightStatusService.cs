using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IFlightStatusService
{
    Task<List<FlightOptionsViewModel>> GetDepartingFlightsAsync(
        string departureAirportCode,
        DateTime? departureDateTime = null,
        string codeType = null,
        string[] extendedOptions = null);
}