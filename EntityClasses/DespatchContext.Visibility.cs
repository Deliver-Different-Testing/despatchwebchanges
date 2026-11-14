using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.EntityClasses;

/// <summary>
/// Visibility anchors for read paths whose own tables carry no scope filter (job children, S3
/// attachments, clients). They go through the filtered job sets, so they follow whatever the job
/// filters allow and skip the lookup entirely for unscoped callers.
/// </summary>
public partial class DespatchContext
{
    public async Task<bool> IsJobVisibleAsync(int jobId) =>
        CurrentBypassFilters || await IsLiveJobAsync(jobId) || await IsJobArchivedAsync(jobId);

    // Captured media and attachments are S3-keyed "<folder>/.../<jobId>-<suffix>" by the job that captured
    // them (often a leg, not the job the caller passes), so the key itself has to name a visible job.
    public async Task<bool> IsMediaKeyVisibleAsync(string key)
    {
        if (CurrentBypassFilters)
        {
            return true;
        }

        var fileName = key?[(key.LastIndexOf('/') + 1)..] ?? string.Empty;
        var dash = fileName.IndexOf('-');
        return dash > 0
               && int.TryParse(fileName[..dash], System.Globalization.NumberStyles.None,
                   System.Globalization.CultureInfo.InvariantCulture, out var jobId)
               && await IsJobVisibleAsync(jobId);
    }

    public async Task<bool> IsClientVisibleAsync(int clientId) =>
        CurrentBypassFilters
        || (CurrentIsCustomerScoped && clientId == CurrentClientId)
        || await TucJobs.AnyAsync(j => j.UcjbClientId == clientId)
        || await TucJobArchives.AnyAsync(j => j.UcjbClientId == clientId);

    // A network partner may book (quick-create) for any active client of the tenant; everyone else
    // books only for the clients they can see.
    public async Task<bool> IsClientBookableAsync(int clientId) =>
        CurrentIsNetworkPartner
            ? await TucClients.AnyAsync(c => c.UcclId == clientId && c.UcclActive == true)
            : await IsClientVisibleAsync(clientId);

    public IQueryable<TucClient> BookableClients(IQueryable<TucClient> clients) =>
        CurrentIsNetworkPartner ? clients : VisibleClients(clients);

    public IQueryable<TucClient> VisibleClients(IQueryable<TucClient> clients) =>
        CurrentBypassFilters
            ? clients
            : clients.Where(c => (CurrentIsCustomerScoped && c.UcclId == CurrentClientId)
                                 || TucJobs.Any(j => j.UcjbClientId == c.UcclId)
                                 || TucJobArchives.Any(j => j.UcjbClientId == c.UcclId));
}
