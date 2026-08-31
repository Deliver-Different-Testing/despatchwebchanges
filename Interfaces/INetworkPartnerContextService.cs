#nullable enable
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Session context specific to a signed-in Network Partner, resolved from the
/// <c>NpAgentId</c> the auth claims already carry.
/// </summary>
public interface INetworkPartnerContextService
{
    /// <summary>
    /// The partner's own address as a map centre, or <c>null</c> when the session
    /// is not a network partner, carries no agent linkage, or the agent record has
    /// not been geocoded. A partner works one address, so opening their maps on
    /// the geographic centre of the country is close to useless.
    /// </summary>
    Task<MapCentre?> GetMapCentreAsync();
}
