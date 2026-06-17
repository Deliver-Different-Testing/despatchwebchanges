using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for splitting a job into a pickup leg and a delivery child job.
/// </summary>
public interface ISplitJobService
{
    /// <summary>
    /// Splits a job by creating two child jobs (pickup and delivery) via raw SQL
    /// inserts. The meeting point address becomes the pickup leg's destination
    /// and the delivery leg's pickup location.
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <param name="courierIdForLegB">Optional courier ID to assign to the delivery leg (Leg B).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple where PickupJobId is the newly created pickup child job
    /// and DeliveryJobId is the newly created delivery child job.
    /// </returns>
    Task<(int PickupJobId, int DeliveryJobId)> SplitJobAsync(
        int jobId,
        string userName,
        AddressViewModel meetingPointAddress,
        int? courierIdForLegB = null,
        CancellationToken ct = default);

    /// <summary>
    /// After a rate-affecting field update on a parent job, re-prices its parts. Behaviour
    /// depends on the parent's relationship type:
    /// <list type="bullet">
    /// <item><b>SplitParent</b> — propagates the field to all non-void children and redistributes
    /// the parent's fixed total proportionally across them (one job's price divided across legs).</item>
    /// <item><b>Multi</b> (multi-drop) — re-rates the parent and every non-void child independently,
    /// so each part is priced for the new vehicle/speed/etc. (the total moves). Parts flagged
    /// RatedManually are left untouched. The field value is assumed already written to every part by
    /// the preceding entity update.</item>
    /// <item>Any other type (e.g. a single job) — no-op; the per-job reprice is handled elsewhere.</item>
    /// </list>
    /// </summary>
    /// <param name="parentJobId">The parent job ID that was just updated.</param>
    /// <param name="field">The field that was updated on the parent.</param>
    /// <param name="value">The new value that was set on the parent.</param>
    /// <param name="ct">Cancellation token.</param>
    Task PropagateUpdateToChildrenAsync(
        int parentJobId,
        JobProperty field,
        string value,
        CancellationToken ct = default);
}
