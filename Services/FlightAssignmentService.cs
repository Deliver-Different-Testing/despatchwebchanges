using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Serilog;

namespace DespatchWeb.Services;

public sealed class FlightAssignmentService(
    IFlightStatsService flightService,
    INationwideJobRepository repository)
    : IFlightAssignmentService
{
    public async Task AssignFlightAsync(AssignFlightToJobRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var webhookIds = await CreateWebhooksAsync(request.FlightSegments);
        await repository.AddJobNationwideAsync(request, webhookIds);
    }

    public async Task<FlightAutoAssignSummary> AutoAssignSavedFlightsAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds is null || jobIds.Count == 0)
        {
            return new FlightAutoAssignSummary(0, 0);
        }

        var candidates = await repository.GetSavedFlightCandidatesAsync(jobIds);
        if (candidates.Count == 0)
        {
            return new FlightAutoAssignSummary(0, 0);
        }

        var assigned = 0;
        var unmatched = 0;

        foreach (var candidate in candidates)
        {
            try
            {
                var match = await FindMatchingFlightAsync(candidate);
                if (match is null)
                {
                    unmatched++;
                    Log.Information(
                        "Auto-assign: no flight matching {SavedFlightNumber} found for job {JobId} on {DepartureDate}",
                        candidate.SavedFlightNumber, candidate.JobId, candidate.DepartureDate);
                    continue;
                }

                await AssignFlightAsync(new AssignFlightToJobRequest
                {
                    JobId = candidate.JobId,
                    FromAirportId = candidate.FromAirportId,
                    ToAirportId = candidate.ToAirportId,
                    FlightNumber = candidate.SavedFlightNumber,
                    DepartureDate = candidate.DepartureDate,
                    FlightSegments = match.FlightSegments
                });
                assigned++;
            }
            catch (Exception ex)
            {
                // Best-effort: one job's failure must never abort the push.
                unmatched++;
                Log.Error(ex,
                    "Auto-assign failed for job {JobId} (saved flight {SavedFlightNumber})",
                    candidate.JobId, candidate.SavedFlightNumber);
            }
        }

        return new FlightAutoAssignSummary(assigned, unmatched);
    }

    private async Task<FlightViewModel> FindMatchingFlightAsync(SavedFlightCandidate candidate)
    {
        var flights = await flightService.GetFlightsAsync(
            candidate.JobId,
            candidate.DepartureDate,
            airlineId: null,
            departureAirportId: candidate.FromAirportId,
            arrivalAirportId: candidate.ToAirportId,
            codeType: "FS");

        if (flights is null || flights.Count == 0)
        {
            return null;
        }

        var target = NormalizeFlightNumber(candidate.SavedFlightNumber);

        return flights
            .Where(f => FlightMatches(f, target))
            .OrderBy(f => f.DepartureTime)
            .FirstOrDefault();
    }

    private static bool FlightMatches(FlightViewModel flight, string target)
    {
        if (NormalizeFlightNumber(flight.AirlineCode + flight.FlightNumber) == target)
        {
            return true;
        }

        // Multi-segment flights expose the operating carrier per segment; match
        // the first leg's "{carrier}{number}" the same way webhook creation builds it.
        var firstSegment = flight.FlightSegments?.FirstOrDefault();
        return firstSegment is not null
               && NormalizeFlightNumber(firstSegment.CarrierFsCode + firstSegment.FlightNumber) == target;
    }

    private static string NormalizeFlightNumber(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Replace(" ", "").Replace("-", "").Trim().ToUpperInvariant();

    private async Task<List<string>> CreateWebhooksAsync(List<FlightSegmentViewModel> flightSegments)
    {
        var webhookIds = new List<string>();
        if (flightSegments is null)
        {
            return webhookIds;
        }

        foreach (var segment in flightSegments)
        {
            var webhookId = await flightService.CreateFlightRuleByDepartureAsync(
                $"{segment.CarrierFsCode}{segment.FlightNumber}",
                segment.DepartureTime,
                segment.DepartureAirportFsCode) ?? string.Empty;

            if (!string.IsNullOrEmpty(webhookId))
            {
                webhookIds.Add(webhookId);
            }
        }

        return webhookIds;
    }
}
