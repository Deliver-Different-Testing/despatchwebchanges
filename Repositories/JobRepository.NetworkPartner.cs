#nullable enable

using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

/// <summary>
/// What a logged-in network partner sees for money on a job.
///
/// A network partner is paid <c>CourierPayment</c> + <c>CourierFuel</c> (tenant → partner layer,
/// populated by the NP triggers at allocation — see network-partner-pay-visibility.md §2.7).
/// The tenant's revenue (<c>ucjbAmount</c>, the PricingBreakdown rows, cost/margin) is never
/// theirs to see. Every NP-facing read that surfaces an amount in the job detail modal goes
/// through here so the substitution happens once, server-side, regardless of which dialog asks.
/// </summary>
public partial class JobRepository
{
    /// <summary>Synthetic charge ids for the two partner-pay lines. Negative so they can never collide
    /// with a real PricingBreakdownId, and stable so the React table has a key.</summary>
    internal const int NetworkPartnerBaseChargeId = -1;
    internal const int NetworkPartnerFuelChargeId = -2;

    internal const string NetworkPartnerBaseChargeName = "Base";
    internal const string NetworkPartnerFuelChargeName = "Fuel";

    /// <summary>
    /// The partner's pay on a job: <c>CourierPayment</c> and <c>CourierFuel</c>, live row first, then
    /// archive. Both sets are behind the NP row-level query filter, so a partner can only ever read
    /// their own jobs here. Null when the job is not visible to the caller.
    /// </summary>
    public async Task<NetworkPartnerPay?> GetNetworkPartnerPayAsync(int jobId)
    {
        var live = await Context.TucJobs
            .Where(j => j.UcjbId == jobId)
            .Select(j => new NetworkPartnerPay(j.CourierPayment ?? 0, j.CourierFuel ?? 0))
            .FirstOrDefaultAsync();
        if (live != null)
        {
            return live;
        }

        return await Context.TucJobArchives
            .Where(j => j.UcjbId == jobId)
            .Select(j => new NetworkPartnerPay(j.CourierPayment ?? 0, j.CourierFuel ?? 0))
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// The price breakdown a network partner sees: two lines, Base = <c>CourierPayment</c> and
    /// Fuel = <c>CourierFuel</c>, in place of the tenant's PricingBreakdown rows. No cost column —
    /// <c>CostAmount</c> stays null so nothing about the tenant's margin leaks into the payload.
    /// Empty when the job is not visible to the caller.
    /// </summary>
    public async Task<IReadOnlyList<ChargeViewModel>> GetNetworkPartnerPriceBreakdownAsync(int jobId, bool isArchived)
    {
        var pay = await GetNetworkPartnerPayAsync(jobId);
        return pay == null ? [] : BuildNetworkPartnerBreakdown(jobId, isArchived, pay);
    }

    internal static IReadOnlyList<ChargeViewModel> BuildNetworkPartnerBreakdown(
        int jobId, bool isArchived, NetworkPartnerPay pay) =>
    [
        new ChargeViewModel
        {
            ChargeId = NetworkPartnerBaseChargeId,
            Name = NetworkPartnerBaseChargeName,
            Amount = pay.CourierPayment,
            JobId = jobId,
            IsArchived = isArchived
        },
        new ChargeViewModel
        {
            ChargeId = NetworkPartnerFuelChargeId,
            Name = NetworkPartnerFuelChargeName,
            Amount = pay.CourierFuel,
            JobId = jobId,
            IsArchived = isArchived
        }
    ];

    /// <summary>
    /// Rewrites <see cref="JobViewModel.Charge"/> on the job and every related job in the group to
    /// the partner's pay, so the Pricing tile in the job detail modal reads what they will be paid
    /// rather than what the tenant is charging. Jobs the partner cannot see (not theirs, hence not
    /// returned by the filtered query) get a null charge rather than the tenant's figure.
    /// </summary>
    private async Task SubstituteNetworkPartnerChargesAsync(JobGroupViewModel group)
    {
        if (group?.Job == null)
        {
            return;
        }

        var jobIds = new List<int> { group.Job.Id };
        if (group.RelatedJobs != null)
        {
            jobIds.AddRange(group.RelatedJobs.Select(r => r.Id));
        }

        var payByJob = await GetNetworkPartnerPayByJobAsync(jobIds);
        ApplyNetworkPartnerCharges(group, payByJob);
    }

    private async Task<IReadOnlyDictionary<int, NetworkPartnerPay>> GetNetworkPartnerPayByJobAsync(
        IReadOnlyCollection<int> jobIds)
    {
        var live = await Context.TucJobs
            .Where(j => jobIds.Contains(j.UcjbId))
            .Select(j => new { j.UcjbId, Pay = new NetworkPartnerPay(j.CourierPayment ?? 0, j.CourierFuel ?? 0) })
            .ToListAsync();

        var result = live.ToDictionary(x => x.UcjbId, x => x.Pay);

        var missing = jobIds.Where(id => !result.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            var archived = await Context.TucJobArchives
                .Where(j => missing.Contains(j.UcjbId))
                .Select(j => new { j.UcjbId, Pay = new NetworkPartnerPay(j.CourierPayment ?? 0, j.CourierFuel ?? 0) })
                .ToListAsync();
            foreach (var row in archived)
            {
                result[row.UcjbId] = row.Pay;
            }
        }

        return result;
    }

    /// <summary>Pure: the charge on each job becomes the partner's total pay for that job, or null when
    /// the partner has no visibility of it. Kept static so the rule is unit-testable without a database.</summary>
    internal static void ApplyNetworkPartnerCharges(
        JobGroupViewModel group, IReadOnlyDictionary<int, NetworkPartnerPay> payByJob)
    {
        if (group?.Job == null)
        {
            return;
        }

        group.Job.Charge = payByJob.TryGetValue(group.Job.Id, out var pay) ? pay.Total : null;

        if (group.RelatedJobs == null)
        {
            return;
        }

        foreach (var related in group.RelatedJobs)
        {
            related.Charge = payByJob.TryGetValue(related.Id, out var relatedPay) ? relatedPay.Total : null;
        }
    }
}
