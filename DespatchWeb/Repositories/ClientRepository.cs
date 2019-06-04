using DespatchWeb.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DespatchWeb.Repositories
{
    public class ClientRepository
    {
        private readonly DespatchWebDataContext _context;

        public ClientRepository(DespatchWebDataContext context)
        {
            _context = context;
        }

        public async Task<ClientViewModel> ValidateClientAsync(int contactId)
        {
            var contact = _context.TucClientContacts.FirstOrDefault(c=>c.UcctId == contactId);
            if (contact == null)
            {
                return null;
            }
            var client = await _context.TblClients.FindAsync(contact.UcctClientId);
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
                Internal = client.Internal
                //ToDo get staffId once Kevin has updated mapping in Mercury
            };
            
        }
    }
}
