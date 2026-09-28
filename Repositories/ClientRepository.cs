using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClientRepository(IDbContextFactory<DespatchContext> contextFactory)
    : BaseRepository(contextFactory),
        IClientRepository
{
    public async Task<ClientViewModel> ValidateClientAsync(int contactId) =>
        await Context.TucClientContacts
            .Where(c => c.UcctId == contactId)
            .Select(c => new ClientViewModel
            {
                Active = c.UcctClient != null && c.UcctClient.UcclActive,
                FirstName = c.UcctFirstname,
                FullName = c.UcctFirstname + " " + c.UcctSurname,
                Email = c.UcctEmail,
                Internal = c.UcctClient != null && c.UcctClient.UcclInternal,
                StaffID = c.StaffId
            })
            .FirstOrDefaultAsync();

    public async Task<IReadOnlyList<Suggestion>> ClientContactsAsync(int contactId) =>
        await Context.TblClientContacts
            .Where(c => c.ContactId == contactId)
            .Where(c => c.TblClientContactInternetPermissions
                .Any(cip => cip.InternetPermission.SystemName == "DespatchWeb"))
            .OrderByDescending(c => c.IsDefaultAccount)
            .Select(c => new Suggestion
            {
                Id = c.ClientId,
                Text = c.Client != null ? c.Client.UcclName : null
            })
            .Distinct()
            .ToListAsync();

    public async Task<IReadOnlyList<Suggestion>> ActiveClientsAsync(string searchTerm)
    {
        var likePattern = $"%{searchTerm}%";

        var results = await Context.TucClients
            .Where(c => c.UcclActive == true &&
                        EF.Functions.Like(c.UcclCode + " " + c.UcclName, likePattern))
            .OrderBy(c => c.UcclCode)
            .Take(50)
            .Select(c => new Suggestion
            {
                Id = c.UcclId,
                Text = c.UcclCode + " " + c.UcclName
            })
            .ToListAsync();

        return results;
    }
}