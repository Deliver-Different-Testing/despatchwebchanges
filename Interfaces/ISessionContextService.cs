#nullable enable
using System.Security.Claims;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface ISessionContextService
{
    /// <summary>
    /// Builds the session context for an authenticated principal whose tenant connection is already set.
    /// Throws <see cref="ArgumentException"/> for an unparseable ContactID and
    /// <see cref="InvalidOperationException"/> when the contact has no row in the tenant database.
    /// </summary>
    Task<SessionContextDto> BuildAsync(ClaimsPrincipal user);
}
