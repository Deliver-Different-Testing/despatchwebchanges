#nullable enable
using System.Text.Json.Nodes;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;

namespace DespatchWeb.Services.AgentRead;

public interface IAgentJobStoryService
{
    Task<JsonObject> GetAsync(string? jobNumber, int? jobId, CancellationToken cancellationToken = default);
}

/// <summary>
/// What happened to a job, from read-only paths: the detail without the mark-as-read write, the journey service without
/// the controller's pending web-quantity write, and the notes list.
/// </summary>
public sealed class AgentJobStoryService(
    IJobQueryRepository jobs,
    INoteRepository notes,
    IDeliveryJourneyService journey) : IAgentJobStoryService
{
    public async Task<JsonObject> GetAsync(string? jobNumber, int? jobId, CancellationToken cancellationToken = default)
    {
        var id = jobId;
        if (id is null)
        {
            if (string.IsNullOrWhiteSpace(jobNumber)) throw new AgentReadException("Give either job (the job number) or job_id.");
            id = await jobs.GetJobIdByNumberAsync(jobNumber.Trim());
            if (id is null) return NotFound(jobNumber);
        }

        JobViewModel? job;
        try
        {
            job = await jobs.GetJobWithoutMarkingReadAsync(id.Value);
        }
        catch (KeyNotFoundException)
        {
            job = null;
        }

        if (job is null) return NotFound(jobNumber ?? id.Value.ToString());

        cancellationToken.ThrowIfCancellationRequested();
        var entries = await journey.GetDeliveryJourneyForJobAsync(id.Value);
        var noteList = await notes.GetNotesByJobIdAsync(id.Value);

        return JobStoryComposer.Compose(ToFacts(job), [.. entries.Select(ToEntry)], [.. noteList.Select(ToNote)]);
    }

    private static JsonObject NotFound(string? job) => new()
    {
        ["found"] = false,
        ["job"] = job,
        ["message"] = "No job with that number or id. Check the number (and the tenant you are connected to)."
    };

    public static JobFacts ToFacts(JobViewModel j) => new(
        j.Id, j.JobNo, j.Client ?? j.ClientName, j.Speed, j.StatusName, j.Void, j.Booked, j.Amount,
        j.AssignedCourier?.Text ?? j.Courier,
        Address(j.PickupAddress) ?? j.From, j.PickupTime, j.PickupArrivalTime, j.PuTime,
        Address(j.DeliveryAddress) ?? j.ToAddress, j.DeliveryTime, j.DeliveryArrivalTime, j.CompletedTime, j.PodName,
        j.DispatchTime, j.RefA);

    private static string? Address(AddressViewModel? a) => a is null
        ? null
        : JobSearchComposer.Address(a.AddressLine1, a.AddressLine2, a.AddressLine3, a.AddressLine4, a.AddressLine5, a.AddressLine6, a.AddressLine7, a.AddressLine8);

    private static JourneyEntry ToEntry(DeliveryJourneyViewModel e) =>
        new(e.Title ?? "", e.Description, e.Date, e.Tags ?? [], e.GrandTotalAfter, e.PerformedBy, e.Icon);

    private static NoteFacts ToNote(TucNoteViewModel n) =>
        new(n.NoteId, n.NoteTypeName, n.NoteText, n.IsImportant, n.CreatedByName, n.CreatedDate, n.UpdatedDate);
}
