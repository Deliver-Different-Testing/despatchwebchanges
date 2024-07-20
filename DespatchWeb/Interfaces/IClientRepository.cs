using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClientRepository
{
    Task<ClientViewModel> ValidateClientAsync(int contactId);
    Task<List<ClientContactViewModel>> ClientContacts(int contactId);
    Task<DispatcherViewModel> ValidateDispatcherLogin(string name);
    Task<List<ClientActiveViewModel>> ActiveClients(string searchTerm);
}