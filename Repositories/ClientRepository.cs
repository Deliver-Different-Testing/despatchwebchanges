using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;


public class ClientRepository(IMapper mapper, IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory), IClientRepository
{
    public async Task<ClientViewModel> ValidateClientAsync(int contactId)
    {
        return await Context.TucClientContacts
            .Where(contact => contact.UcctId == contactId)
            .Join(Context.TblClients,
                contact => contact.UcctClientId,
                client => client.ClientId,
                (contact, client) => new ClientViewModel
                {
                    Active = client.Active,
                    FirstName = contact.UcctFirstname,
                    FullName = $"{contact.UcctFirstname} {contact.UcctSurname}",
                    Email = contact.UcctEmail,
                    Internal = client.Internal,
                    StaffID = contact.StaffId
                })
            .FirstOrDefaultAsync();
    }


    public async Task<List<ClientContactViewModel>> ClientContactsAsync(int contactId)
    {
        return await Context.TblClientContacts
            .Where(c => c.ContactId == contactId)
            .Join(Context.TblClientContactInternetPermissions,
                c => c.ClientContactId,
                cip => cip.ClientContactId,
                (c, cip) => new { c, cip })
            .Join(Context.TblInternetPermissions,
                joined => joined.cip.InternetPermissionId,
                ip => ip.InternetPermissionId,
                (joined, ip) => new { joined.c, ip })
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

    public async Task<DispatcherViewModel> ValidateDispatcherLoginAsync(string name)
    {
        var result = await Context.Procedures.INT_stpIsValidLogin_DespatchAsync(name);
        return mapper.Map<DispatcherViewModel>(result.FirstOrDefault());
    }

    public async Task<List<ClientActiveViewModel>> ActiveClientsAsync(string searchTerm)
    {
        var result = await Context.Procedures.DESWEB_qryClientsActiveAsync(searchTerm);
        return mapper.Map<List<ClientActiveViewModel>>(result);
    }
}
