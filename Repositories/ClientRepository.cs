using DespatchWeb.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.EntityClasses;
using DespatchWebContextExtensions;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories
{
    public class ClientRepository(IDbContextFactory<DespatchContext> contextFactory) : BaseRepository(contextFactory)
    {
        public async Task<ClientViewModel> ValidateClientAsync(int contactId)
        {
            var contact = await Context.TucClientContacts.FirstOrDefaultAsync(c=>c.UcctId == contactId);
            if (contact == null)
            {
                return null;
            }
            var client = await Context.TblClients.FirstOrDefaultAsync(x=>x.ClientId == contact.UcctClientId);
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
            var clientContacts = from c in Context.TblClientContacts
                join cip in Context.TblClientContactInternetPermissions on c.ClientContactId equals cip.ClientContactId
                join ip in Context.TblInternetPermissions on cip.InternetPermissionId equals ip.InternetPermissionId
                where (c.ContactId == contactId && ip.SystemName == "DespatchWeb")
                orderby (c.IsDefaultAccount)
                select new ClientContactViewModel()
                {
                    ID = c.ClientId,
                    Text = c.Client.UcclName
                };
            return await clientContacts.ToListAsync();

        }

        public async Task<DispatcherViewModel> ValidateDispatcherLogin(string name)
        {
            var result = new List<DispatcherViewModel>();
            await Context.LoadStoredProc("INT_stpIsValidLogin_Despatch")
                .WithSqlParam("@WindowsLogonUserName", name)
                .ExecuteStoredProcAsync(handle => { result = handle.ReadToList<DispatcherViewModel>().ToList(); });
            return result.FirstOrDefault();

        }

        public async Task<List<ClientActiveViewModel>> ActiveClients(string searchTerm)
        {
            var activeCouriers = new List<ClientActiveViewModel>();
            await Context.LoadStoredProc("DESWEB_qryClientsActive")
                .WithSqlParam("@SearchTerm", searchTerm)
                .ExecuteStoredProcAsync(handle =>
                {
                    activeCouriers = handle.ReadToList<ClientActiveViewModel>().ToList();
                });
            return activeCouriers;
        }
    }
}
