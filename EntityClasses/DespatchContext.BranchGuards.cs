using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.EntityClasses;

// Branches programme (B2): by-id guards for actions that bypass the EF filters (stored procedures, S3 keys, raw
// ExecuteDelete). Everyone who is not branch limited passes untouched; branch-limited staff pass only for jobs and
// couriers the filters let them see.
public partial class DespatchContext
{
    /// <summary>True when every id is a live or archived job the caller can see (always true when not branch limited).</summary>
    public async Task<bool> AllJobsVisibleAsync(IReadOnlyCollection<int> jobIds)
    {
        if (!CurrentIsBranchScoped || jobIds.Count == 0)
        {
            return true;
        }

        var ids = jobIds.Distinct().ToList();
        var live = await TucJobs.Where(j => ids.Contains(j.UcjbId)).Select(j => j.UcjbId).ToListAsync();
        var rest = ids.Except(live).ToList();
        if (rest.Count == 0)
        {
            return true;
        }

        var archived = await TucJobArchives.Where(j => rest.Contains(j.UcjbId)).Select(j => j.UcjbId).Distinct().CountAsync();
        return archived == rest.Count;
    }

    /// <summary>True when the courier is in the caller's courier list (always true when not branch limited).</summary>
    public async Task<bool> CourierVisibleAsync(int courierId) =>
        !CurrentIsBranchScoped || await TucCouriers.AnyAsync(c => c.UccrId == courierId);

    /// <summary>True when the bulk job is one the caller can see (always true when not branch limited).</summary>
    public async Task<bool> BulkJobVisibleAsync(int bulkJobId) =>
        !CurrentIsBranchScoped || await TblBulkJobs.AnyAsync(b => b.BulkJobId == bulkJobId);
}
