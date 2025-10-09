using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClientRepository
{
    Task<ClientViewModel> ValidateClientAsync(int contactId);
    Task<List<Suggestion>> ClientContactsAsync(int contactId);
    Task<List<Suggestion>> ActiveClientsAsync(string searchTerm);
}
