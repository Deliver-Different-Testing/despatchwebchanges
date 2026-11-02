using System.Text.Json;
using Anthropic.Models.Beta.Messages;

namespace DespatchWeb.Interfaces;

public interface IAutoMateTool
{
    BetaTool Definition { get; }

    /// <summary>Reads tenant data the database doesn't scope per customer, so only staff may have it.</summary>
    bool StaffOnly { get; }

    Task<string> ExecuteAsync(JsonElement input, CancellationToken ct);
}

/// <summary>Marks the CSP knowledge-base tools, which are left out when CSP can't be reached.</summary>
public interface IKnowledgeBaseTool : IAutoMateTool;
