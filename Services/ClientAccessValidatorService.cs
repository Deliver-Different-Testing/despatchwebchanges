using System;
using System.Linq;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// Service for validating client access permissions based on contact associations.
/// </summary>
public class ClientAccessValidatorService(IClientRepository clientRepo) : IClientAccessValidatorService
{
    /// <summary>
    /// Validates that a contact has access to the specified client IDs.
    /// Throws UnauthorizedAccessException if the contact does not have access to any of the requested clients.
    /// </summary>
    /// <param name="contactId">The contact ID to validate access for.</param>
    /// <param name="clientIds">A comma-separated string of client IDs to check access to.</param>
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