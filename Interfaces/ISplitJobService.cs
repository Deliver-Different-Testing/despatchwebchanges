#nullable enable
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

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
    /// <para>
    /// A leg only carries dispatch metadata when it is genuinely going to a courier: the pickup leg
    /// inherits the job's real courier, dispatch stamps and pickup time, and the delivery leg is
    /// stamped only when <paramref name="courierIdForLegB"/> is supplied. When the job was already
    /// dispatched, the now-parent is taken off the original courier's device and that courier's
    /// remaining jobs are re-sent to it after the split commits.
    /// </para>
    /// </summary>
    /// <param name="jobId">The ID of the job to split.</param>
    /// <param name="userName">The username performing the split.</param>
    /// <param name="meetingPointAddress">The meeting point address data including all address lines.</param>
    /// <param name="courierIdForLegB">Optional courier ID to assign to the delivery leg (Leg B).</param>
    /// <param name="pricingAllocation">
    /// Optional per-leg shares confirmed by the user. When null the service derives the split from
    /// per-leg road miles, falling back to straight-line miles, then leg rates, then an even split.
    /// </param>
    /// <param name="lineAllocation">
    /// Optional per-line shares for charges that shouldn't follow the overall split — a congestion
    /// charge only one leg's route incurred, say. Lines not listed use <paramref name="pricingAllocation"/>.
    /// </param>
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
        IReadOnlyList<SplitPricingAllocationItem>? pricingAllocation = null,
        IReadOnlyList<SplitPricingLineAllocationItem>? lineAllocation = null,
        CancellationToken ct = default);

    /// <summary>
    /// After a rate-affecting field update on a parent job, re-prices its parts. Behaviour
    /// depends on the parent's relationship type:
    /// <list type="bullet">
    /// <item><b>SplitParent</b> — propagates the field to all non-void children and redistributes
    /// the parent's fixed total across them in their existing proportions, rescaling each leg's
    /// breakdown lines to match (one job's price divided across legs). Keeping the proportions
    /// preserves the division agreed when the job was split, including any per-line shares.</item>
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

    /// <summary>
    /// Lists the jobs a date change on <paramref name="jobId"/> could cascade to, so the user can
    /// confirm the blast radius before anything is written. Void legs are excluded outright;
    /// locked and partner legs are returned with <see cref="DateCascadeFamilyMember.Cascadable"/>
    /// false so the dialog can show what will not move.
    /// </summary>
    /// <param name="jobId">The parent job the user is editing.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<DateCascadeFamily> GetDateCascadeFamilyAsync(
        int jobId,
        CancellationToken ct = default);

    /// <summary>
    /// Copies a confirmed date change from a parent job down to its family. Unlike
    /// <see cref="PropagateUpdateToChildrenAsync"/> this neither redistributes the parent's total
    /// nor re-rates anything — any resulting price change is surfaced to the user separately and
    /// applied only if they accept it.
    /// <para>
    /// Children always receive <see cref="JobProperty.Date"/>, even when the parent was edited via
    /// <see cref="JobProperty.BookedTime"/>, so each leg keeps its own time.
    /// </para>
    /// </summary>
    /// <param name="parentJobId">The parent job that was just updated.</param>
    /// <param name="field">The field edited on the parent; non-date fields are a no-op.</param>
    /// <param name="value">The new value that was set on the parent.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Which children were updated and which failed.</returns>
    Task<DateCascadeResult> PropagateDateToChildrenAsync(
        int parentJobId,
        JobProperty field,
        string value,
        CancellationToken ct = default);
}
