using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClientRepository
{
    Task<List<ClientContactViewModel>> ClientContactsAsync(int contactId);
    Task<DispatcherViewModel> TempLoginAsync();
    Task<DispatcherViewModel> ValidateDispatcherLoginAsync(string name);
    Task<DispatcherViewModel> ValidateDispatcherLoginAsync(string name);
    Task<List<ClientActiveViewModel>> ActiveClientsAsync(string searchTerm);
}
