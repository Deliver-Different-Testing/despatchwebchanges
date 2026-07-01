using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IFlightAssignmentService
{
    /// <summary>
    /// Creates the Cirium webhook alerts for the request's flight segments and
    /// persists the flight assignment against the job. Shared by the manual
    /// assign endpoint and the recurring push-to-live auto-assign path.
    /// </summary>
    Task AssignFlightAsync(AssignFlightToJobRequest request);

    /// <summary>
    /// Best-effort: for each job that came from a recurring booking with a
    /// saved flight number, re-search the route for the job's departure date,
    /// match the saved flight number, and auto-assign it. Never throws for a
    /// single job — unmatched / failed jobs are counted, not fatal.
    /// </summary>
    Task<FlightAutoAssignSummary> AutoAssignSavedFlightsAsync(IReadOnlyList<int> jobIds);
}

public readonly record struct FlightAutoAssignSummary(int Assigned, int Unmatched);
