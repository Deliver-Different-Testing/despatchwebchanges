using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.FlightStats;

namespace DespatchWeb.Interfaces;

public interface INationwideJobRepository
{
    Task<List<JobViewModel>> NationwideJobListAsync(string status,
        string order, string ascending, bool isInternal, string clientIds, NationwideWindowPanel windowPane,
        List<int> selectedViewIds);

    Task<bool> AddJobNationwide(int jobId, ScheduledFlight flight);

    Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId);
}
