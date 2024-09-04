using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly DespatchContext _context;
    private readonly IMapper _mapper;

    public ClientRepository(DespatchContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<ClientViewModel> ValidateClientAsync(int contactId)
    {
        var result = await _context.TucClientContacts
            .Join(_context.TblClients,
                contact => contact.UcctClientId,
                client => client.ClientId,
                (contact, client) => new { Contact = contact, Client = client })
            .Where(joined => joined.Contact.UcctId == contactId)
            .Select(joined => new ClientViewModel
            {
                Active = joined.Client.Active,
                FirstName = joined.Contact.UcctFirstname,
                FullName = joined.Contact.UcctFirstname + " " + joined.Contact.UcctSurname,
                Email = joined.Contact.UcctEmail,
                Internal = joined.Client.Internal,
                StaffID = joined.Contact.StaffId
            })
            .FirstOrDefaultAsync();

        return result;
    }

    public async Task<List<ClientContactViewModel>> ClientContactsAsync(int contactId)
    {
        var clientContacts = await _context.TblClientContacts
            .Where(c => c.ContactId == contactId)
            .Join(_context.TblClientContactInternetPermissions,
                c => c.ClientContactId,
                cip => cip.ClientContactId,
                (c, cip) => new { c, cip })
            .Join(_context.TblInternetPermissions,
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

        return clientContacts;
    }

    public async Task<DispatcherViewModel> ValidateDispatcherLoginAsync(string name)
    {
        var result = await _context.Procedures.INT_stpIsValidLogin_DespatchAsync(name);
        return _mapper.Map<DispatcherViewModel>(result.FirstOrDefault());
    }

    public async Task<List<ClientActiveViewModel>> ActiveClientsAsync(string searchTerm)
    {
        var result = await _context.Procedures.DESWEB_qryClientsActiveAsync(searchTerm);
        return _mapper.Map<List<ClientActiveViewModel>>(result);
    }
}
