using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using DespatchWeb.Controllers;
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
        var contact = await _context.TucClientContacts.FirstOrDefaultAsync(c => c.UcctId == contactId);
        if (contact == null)
        {
            return null;
        }

        var client = await _context.TblClients.FirstOrDefaultAsync(x => x.ClientId == contact.UcctClientId);
        if (client == null)
        {
            return null;
        }

        return new ClientViewModel
        {
            Active = client.Active,
            FirstName = contact.UcctFirstname,
            FullName = contact.UcctFirstname + " " + contact.UcctSurname,
            Email = contact.UcctEmail,
            Internal = client.Internal,
            StaffID = contact.StaffId
        };
    }

    public async Task<List<ClientContactViewModel>> ClientContacts(int contactId)
    {
        var clientContacts = from c in _context.TblClientContacts
            join cip in _context.TblClientContactInternetPermissions on c.ClientContactId equals cip.ClientContactId
            join ip in _context.TblInternetPermissions on cip.InternetPermissionId equals ip.InternetPermissionId
            where c.ContactId == contactId && ip.SystemName == "DespatchWeb"
            orderby c.IsDefaultAccount
            select new ClientContactViewModel
            {
                ID = c.ClientId,
                Text = c.Client.UcclName
            };
        return await clientContacts.ToListWithNoLockAsync();
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
