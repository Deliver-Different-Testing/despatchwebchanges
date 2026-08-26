#nullable enable

using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;

namespace DespatchWeb.Services;

/// <inheritdoc />
public sealed class PodMediaService(
    IJobQueryRepository jobRepository,
    IJobPhotoService jobPhotoService
) : IPodMediaService
{
    public Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryMediaAsync(int jobId, int year, int month) =>
        GatherAsync(
            jobId, year, month,
            JobLegRole.FinalMileDelivery,
            leg => leg.CompletedTime,
            jobPhotoService.GetDeliveryPhotosAsync);

    public Task<IReadOnlyList<S3PhotoInfo>> GetPickupMediaAsync(int jobId, int year, int month) =>
        GatherAsync(
            jobId, year, month,
            JobLegRole.LinehaulPickup,
            leg => leg.PickUpTime ?? leg.CompletedTime ?? leg.DispatchedTime,
            jobPhotoService.GetPickupPhotosAsync);

    /// <param name="preferredRole">
    /// The leg whose media leads the result. Consumers take the first signature they find, so the
    /// final-mile signature has to beat a linehaul handover scrawl on a POD.
    /// </param>
    /// <param name="referenceTime">The timestamp that keys a leg's S3 month folder.</param>
    private async Task<IReadOnlyList<S3PhotoInfo>> GatherAsync(
        int jobId,
        int fallbackYear,
        int fallbackMonth,
        JobLegRole preferredRole,
        Func<PodMediaLeg, DateTime?> referenceTime,
        Func<int, int, int, Task<IReadOnlyList<S3PhotoInfo>>> fetch)
    {
        var legs = await jobRepository.GetPodMediaLegsAsync(jobId);

        // A leg with no timestamp of its own falls back to the caller's month; one with neither is
        // dropped rather than probed under year 0.
        var lookups = legs
            .OrderBy(leg => LegRank(leg, preferredRole))
            .ThenBy(leg => leg.JobNumber, StringComparer.Ordinal)
            .Select(leg => (
                leg.JobId,
                Year: referenceTime(leg)?.Year ?? fallbackYear,
                Month: referenceTime(leg)?.Month ?? fallbackMonth))
            .Where(lookup => lookup.Year > 0)
            .ToList();

        var media = new List<S3PhotoInfo>();
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);

        foreach (var (legJobId, year, month) in lookups)
        {
            var found = await fetch(legJobId, year, month);
            media.AddRange(found.Where(item => seenKeys.Add(item.S3Key)));
        }

        return media;
    }

    private static int LegRank(PodMediaLeg leg, JobLegRole preferredRole)
    {
        if (JobLegRoles.FromJobNumber(leg.JobNumber) == preferredRole)
        {
            return 0;
        }

        return leg.IsRequestedJob ? 1 : 2;
    }
}