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
        return await _context.TucClientContacts
            .Where(contact => contact.UcctId == contactId)
            .Join(_context.TblClients,
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
        return await _context.TblClientContacts
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
    }

    public async Task<DispatcherViewModel> TempLoginAsync()
    {
        var account = await _context.TucStaffs
            .Where(s => s.UcstWindowsLogonName == "jacobt")
            .Select(s => new DispatcherViewModel
            {
                FirstName = s.UcstFirstName,
                LastName = s.UcstLastName,
                StaffID = s.UcstId
            })
            .FirstOrDefaultAsync();

        return account;
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
