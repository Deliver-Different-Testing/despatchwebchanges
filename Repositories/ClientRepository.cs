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
    public async Task<ClientViewModel> ValidateClientAsync(int contactId)
    {
        return await Context
            .TucClientContacts.Where(contact => contact.UcctId == contactId)
            .Join(
                Context.TblClients,
                contact => contact.UcctClientId,
                client => client.ClientId,
                (contact, client) =>
                    new ClientViewModel
                    {
                        Active = client.Active,
                        FirstName = contact.UcctFirstname,
                        FullName = contact.UcctFirstname + " " + contact.UcctSurname,
                        Email = contact.UcctEmail,
                        Internal = client.Internal,
                        StaffID = contact.StaffId
                    }
            )
            .FirstOrDefaultAsync();
    }

    public async Task<List<ClientContactViewModel>> ClientContactsAsync(int contactId)
    {
        return await Context
            .TblClientContacts.Where(c => c.ContactId == contactId)
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
            .Select(joined => new ClientContactViewModel
            {
                ID = joined.c.ClientId,
                Text = joined.c.Client.UcclName
            })
            .Distinct()
            .ToListAsync();
    }

    public async Task<List<ClientActiveViewModel>> ActiveClientsAsync(string searchTerm)
    {
        var likePattern = $"%{searchTerm}%";

        var results = await Context.TucClients
            .Where(c => c.UcclActive == true &&
                        EF.Functions.Like(c.UcclCode + " " + c.UcclName, likePattern))
            .OrderBy(c => c.UcclCode)
            .Select(c => new ClientActiveViewModel
            {
                ID = c.UcclId,
                Text = c.UcclCode + " " + c.UcclName
            })
            .ToListAsync();

        return results;
    }
}