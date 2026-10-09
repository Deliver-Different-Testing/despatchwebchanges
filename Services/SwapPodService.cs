using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Response;
using Serilog;

namespace DespatchWeb.Services;

public sealed class SwapPodService(
    IJobQueryRepository jobQueryRepository,
    IJobCommandRepository jobCommandRepository,
    IJobPhotoService jobPhotoService) : ISwapPodService
{
    /// <summary>
    /// Order matters: copy media, then commit the DB, then delete the originals. A failure before the
    /// commit removes the copies and leaves the originals, so no photo is ever lost.
    /// </summary>
    public async Task<SwapPodResult> SwapAsync(string job1, string job2)
    {
        var a = await jobQueryRepository.GetSwapPodJobAsync(job1)
                ?? throw new SwapPodException($"Job {job1} was not found or is not live.");
        var b = await jobQueryRepository.GetSwapPodJobAsync(job2)
                ?? throw new SwapPodException($"Job {job2} was not found or is not live.");

        if (a.JobId == b.JobId)
        {
            throw new SwapPodException("A job's POD cannot be swapped with itself.");
        }

        if (!a.IsDone)
        {
            throw new SwapPodException($"Job {a.Number} has no POD to swap.");
        }

        var aKeys = await ListKeysAsync(a);
        var bKeys = b.IsDone ? await ListKeysAsync(b) : [];
        var occupied = new HashSet<string>(aKeys.Concat(bKeys), StringComparer.Ordinal);

        var copies = new List<DeliveryMediaCopy>();
        var failed = 0;
        foreach (var (from, to, keys) in new[] { (a, b, aKeys), (b, a, bKeys) })
        {
            if (keys.Count == 0)
            {
                continue;
            }

            var result = await jobPhotoService.CopyDeliveryMediaAsync(from.JobId, to.JobId, keys, occupied);
            copies.AddRange(result.Copied);
            failed += result.Failed;
        }

        try
        {
            await jobCommandRepository.SwapPodStateAsync(a.JobId, b.JobId);
        }
        catch
        {
            foreach (var copy in copies)
            {
                await jobPhotoService.DeleteFileAsync(copy.CopyKey);
            }

            throw;
        }

        var moved = 0;
        foreach (var copy in copies)
        {
            if (await jobPhotoService.DeleteFileAsync(copy.SourceKey))
            {
                moved++;
            }
            else
            {
                failed++;
                Log.Warning("POD swap {Job1}/{Job2}: copied {CopyKey} but could not delete original {SourceKey}",
                    a.Number, b.Number, copy.CopyKey, copy.SourceKey);
            }
        }

        return new SwapPodResult(moved, failed);
    }

    private async Task<IReadOnlyList<string>> ListKeysAsync(SwapPodJob job) =>
        job.CompletedTime is { } completed
            ? await jobPhotoService.ListDeliveryMediaKeysAsync(job.JobId, completed.Year, completed.Month)
            : [];
}
