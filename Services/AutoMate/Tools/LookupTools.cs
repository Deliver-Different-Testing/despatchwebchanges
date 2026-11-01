#nullable enable
using System.Text;
using System.Text.Json;
using Anthropic.Models.Beta.Messages;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services.AutoMate.Tools;

public sealed class FindDriversTool(IJobQueryRepository jobs, ICourierRepository couriers, AutoMateAudience audience) : IAutoMateTool
{
    private const int MaxRows = 15;

    private static readonly BetaTool Tool = new()
    {
        Name = "find_drivers",
        Description = "List the drivers who could take a job, in the order dispatch's allocation rules rank them, with the rule that qualifies each. Give job_id or job_number.",
        InputSchema = new InputSchema { Properties = JobReference.Properties }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => true;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        if (!audience.IsStaff)
        {
            return ToolOutput.Error(ToolOutput.StaffOnlyMessage);
        }

        var (jobId, error) = await JobReference.ResolveAsync(input, jobs);
        if (jobId is not { } id)
        {
            return ToolOutput.Error(error!);
        }

        var candidates = await couriers.GetPotentialCouriersAsync(id);
        if (candidates.Count == 0)
        {
            return $"No drivers qualify for job {id} under the allocation rules.";
        }

        var sb = new StringBuilder($"{candidates.Count} driver(s) qualify for job {id}");
        sb.Append(candidates.Count > MaxRows ? $"; showing the first {MaxRows}.\n" : ".\n");
        foreach (var c in candidates.OrderBy(c => c.RuleNumber).Take(MaxRows))
        {
            sb.Append($"- driver id {c.CourierId}, {AiDataSanitizer.SanitizeUntrusted($"{c.Code} {c.FirstName}")}: rule {c.RuleNumber}, {AiDataSanitizer.SanitizeUntrusted(c.Reason ?? string.Empty)}\n");
        }

        return sb.ToString();
    }
}

public sealed class FindClientTool(IClientRepository clients, AutoMateAudience audience) : IAutoMateTool
{
    private const int MaxRows = 10;

    private static readonly BetaTool Tool = new()
    {
        Name = "find_client",
        Description = $"Find active clients by code or name. Returns at most {MaxRows}, with the client id that search_jobs takes.",
        InputSchema = new InputSchema
        {
            Properties = new Dictionary<string, JsonElement>
            {
                ["name"] = ToolSchema.Prop("string", "Part of the client's code or name, at least 2 characters")
            },
            Required = ["name"]
        }
    };

    public BetaTool Definition => Tool;

    public bool StaffOnly => true;

    public async Task<string> ExecuteAsync(JsonElement input, CancellationToken ct)
    {
        if (!audience.IsStaff)
        {
            return ToolOutput.Error(ToolOutput.StaffOnlyMessage);
        }

        var args = new ToolArgs(input);
        var name = args.String("name")?.Trim();
        if (args.Error is not null || name is not { Length: >= 2 })
        {
            return ToolOutput.Error(args.Error ?? "'name' must be at least 2 characters.");
        }

        var matches = await clients.ActiveClientsAsync(name);
        if (matches.Count == 0)
        {
            return $"No active client matches \"{name}\".";
        }

        var sb = new StringBuilder();
        foreach (var client in matches.Take(MaxRows))
        {
            sb.Append($"- client id {client.Id}: {AiDataSanitizer.SanitizeUntrusted(client.Text ?? string.Empty)}\n");
        }

        if (matches.Count > MaxRows)
        {
            sb.Append($"…and {matches.Count - MaxRows} more; narrow the search.\n");
        }

        return sb.ToString();
    }
}
