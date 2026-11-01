#nullable enable
using System.Collections.Concurrent;

namespace DespatchWeb.Services.AutoMate;

/// <summary>
/// One circuit per CSP profile, so a registration problem with the limited customer profile
/// can't switch the knowledge base off for staff too.
/// </summary>
public sealed class CspKnowledgeCircuits(TimeProvider timeProvider)
{
    private readonly ConcurrentDictionary<string, CspKnowledgeCircuit> _circuits = new();

    public CspKnowledgeCircuit For(string? profile) =>
        _circuits.GetOrAdd(profile ?? string.Empty, _ => new CspKnowledgeCircuit(timeProvider));
}
