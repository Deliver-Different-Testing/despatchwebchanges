using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClientRepository
{
    Task<ClientViewModel> ValidateClientAsync(int contactId);
    Task<List<ClientContactViewModel>> ClientContactsAsync(int contactId);
    Task<List<ClientActiveViewModel>> ActiveClientsAsync(string searchTerm);
}
