using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Tests.Repositories;

internal class VoidTestJob
{
    public int Id { get; init; }
    public int? ParentId { get; init; }
}

internal static class VoidJobSelectionLogic
{
    public static List<int> GetWithChildren(int jobId, List<VoidTestJob> allJobs)
    {
        var childIds = allJobs
            .Where(j => j.ParentId == jobId)
            .Select(j => j.Id)
            .ToList();

        childIds.Add(jobId);
        return childIds;
    }

    public static List<int> GetAllRelatedIncludingParent(int jobId, List<VoidTestJob> allJobs)
    {
        var job = allJobs.FirstOrDefault(j => j.Id == jobId);
        if (job == null)
        {
            return [];
        }

        List<int> relatedJobIds;
        if (job.ParentId.HasValue)
        {
            relatedJobIds = allJobs
                .Where(j => j.ParentId == job.ParentId)
                .Select(j => j.Id)
                .ToList();
            relatedJobIds.Add(job.ParentId.Value);
        }
        else
        {
            relatedJobIds = allJobs
                .Where(j => j.ParentId == jobId)
                .Select(j => j.Id)
                .ToList();
            relatedJobIds.Add(jobId);
        }

        return relatedJobIds;
    }

    public static List<int> DetermineToVoid(VoidJobRequest data, List<VoidTestJob> allJobs)
    {
        if (data.SelectedJobIds is { Count: > 0 })
        {
            return data.SelectedJobIds;
        }

        return data.VoidSingleJobOnly
            ? GetWithChildren(data.JobId, allJobs)
            : GetAllRelatedIncludingParent(data.JobId, allJobs);
    }
}
