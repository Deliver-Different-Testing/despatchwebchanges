using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface IClientRepository
{
    Task<ClientViewModel> ValidateClientAsync(int contactId);
    Task<IReadOnlyList<Suggestion>> ClientContactsAsync(int contactId);
    Task<IReadOnlyList<Suggestion>> ActiveClientsAsync(string searchTerm);
}
