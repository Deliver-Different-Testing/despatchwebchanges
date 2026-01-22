using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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
            .AsNoTracking()
            .Where(contact => contact.UcctId == contactId)
            .Join(
                Context.TucClients,
                contact => contact.UcctClientId,
                client => client.UcclId,
                (contact, client) =>
                    new ClientViewModel
                    {
                        Active = client.UcclActive,
                        FirstName = contact.UcctFirstname,
                        FullName = contact.UcctFirstname + " " + contact.UcctSurname,
                        Email = contact.UcctEmail,
                        Internal = client.UcclInternal,
                        StaffID = contact.StaffId
                    }
            )
            .FirstOrDefaultAsync();

    public async Task<List<Suggestion>> ClientContactsAsync(int contactId) =>
        await Context.TblClientContacts
            .AsNoTracking()
            .Where(c => c.ContactId == contactId)
            .Join(
                Context.TblClientContactInternetPermissions,
                c => c.ClientContactId,
                cip => cip.ClientContactId,
                (c, cip) => new { c, cip }
            )
            .Join(
                Context.TblInternetPermissions,
                joined => joined.cip.InternetPermissionId,
                ip => ip.InternetPermissionId,
                (joined, ip) => new { joined.c, ip }
            )
            .Where(joined => joined.ip.SystemName == "DespatchWeb")
            .OrderByDescending(joined => joined.c.IsDefaultAccount)
            .Select(joined => new Suggestion
            {
                Id = joined.c.ClientId,
                Text = joined.c.Client.UcclName
            })
            .Distinct()
            .ToListAsync();

    public async Task<List<Suggestion>> ActiveClientsAsync(string searchTerm)
    {
        var likePattern = $"%{searchTerm}%";

        var results = await Context.TucClients
            .AsNoTracking()
            .Where(c => c.UcclActive == true &&
                        EF.Functions.Like(c.UcclCode + " " + c.UcclName, likePattern))
            .OrderBy(c => c.UcclCode)
            .Select(c => new Suggestion
            {
                Id = c.UcclId,
                Text = c.UcclCode + " " + c.UcclName
            })
            .ToListAsync();

        return results;
    }
}