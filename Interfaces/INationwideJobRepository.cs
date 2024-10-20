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

    Task<bool> AddJobNationwideAsync(int jobId, ScheduledFlight flight, string webhookAlertId);

    Task<(string toAirport, string fromAirport)> GetAirportCodesByJobIdAsync(int jobId);
    Task<IEnumerable<AgentViewModel>> GetAgentsAsync(int jobId);
}