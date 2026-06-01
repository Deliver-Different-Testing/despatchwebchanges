using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// Service for validating client access permissions based on contact associations.
/// </summary>
public sealed class ClientAccessValidatorService(IClientRepository clientRepo) : IClientAccessValidatorService
{
    /// <summary>
    /// Validates that a contact has access to the specified client IDs.
    /// Throws UnauthorizedAccessException if the contact does not have access to any of the requested clients.
    /// </summary>
    /// <param name="contactId">The contact ID to validate access for.</param>
    /// <param name="clientIds">A comma-separated string of client IDs to check access to.</param>
    public async Task ValidateClientAccessAsync(int contactId, string clientIds)
    {
        if (string.IsNullOrEmpty(clientIds))
        {
            return;
        }

        var clientContacts = await clientRepo.ClientContactsAsync(contactId);

        // Safely parse client IDs with validation to prevent exceptions from malformed input
        var requestedClientIds = new HashSet<int>();
        foreach (var idString in clientIds.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (int.TryParse(idString.Trim(), out var id))
            {
                requestedClientIds.Add(id);
            }
        }
        // Silently ignore non-numeric values to prevent DoS through malformed input

        if (requestedClientIds.Count == 0)
        {
            return;
        }

        var hasAccess = clientContacts?
            .Select(c => c.Id)
            .Any(x => requestedClientIds.Contains(x)) ?? false;

        if (!hasAccess)
        {
            throw new UnauthorizedAccessException();
        }
    }
}