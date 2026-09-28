#nullable enable
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Resolves the current request's <see cref="ScopeContext"/> from Hub-issued
/// auth claims (<c>ClientTypeId</c>, <c>ClientID</c>, <c>NpAgentId</c>), with
/// a transitional DB fallback for pre-2026-06-03 sessions whose cookies do
/// not yet carry the data-scope claims.
/// </summary>
public interface IScopeProvider
{
    ScopeContext? Scope { get; }
}
