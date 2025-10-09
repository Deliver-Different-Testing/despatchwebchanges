using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

public class ClientAccessValidatorService(IClientRepository clientRepo) : IClientAccessValidatorService
{
    public async Task ValidateClientAccessAsync(int contactId, string clientIds)
    {
        if (string.IsNullOrEmpty(clientIds)) return;

        var clientContacts = await clientRepo.ClientContactsAsync(contactId);
        var requestedClientIds = clientIds.Split(',').Select(int.Parse).ToHashSet();

        var hasAccess = clientContacts?
            .Select(c => c.Id)
            .Any(x => requestedClientIds.Contains(x)) ?? false;

        if (!hasAccess) throw new UnauthorizedAccessException();
    }
}