using DespatchWeb.Enums;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Turns a dispatcher's manual arrival-field correction into a real waiting-time rerate.
/// Editing <see cref="JobProperty.PickupArrivalTime" /> or
/// <see cref="JobProperty.DeliveryArrivalTime" /> used to be a bare timestamp write, leaving
/// ops to correct the waiting charge as a second manual action. This derives the waited
/// minutes the edit implies and then runs the normal live-job rerate, so the amount and the
/// pricing breakdown come out of rating rather than a hand-written charge row.
/// </summary>
public interface IArrivalWaitRerateService
{
    /// <summary>
    /// Handles a completed field edit. A no-op unless <paramref name="field" /> is an arrival
    /// field on a live job with a waiting basis. Never throws — a rating failure must not turn
    /// an already-successful field write into an error.
    /// </summary>
    Task HandleArrivalEditAsync(int jobId, JobProperty field, CancellationToken ct);
}
