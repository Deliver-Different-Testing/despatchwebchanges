#nullable enable

namespace DespatchWeb.Interfaces;

/// <summary>
/// Resolves the current request's Network Partner agent id. Drives the
/// <c>DespatchContext</c> global query filters that restrict NP users to
/// jobs routed to their agent. Returns <c>null</c> for internal staff,
/// customer-portal users, background workers, and any request without
/// an authenticated NP contact — in which case the filters short-circuit
/// and every row is visible.
/// </summary>
public interface INpScopeProvider
{
    int? NpAgentId { get; }
}
