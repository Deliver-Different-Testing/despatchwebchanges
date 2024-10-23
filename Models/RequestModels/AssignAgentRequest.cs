using System.Text.Json.Serialization;

namespace DespatchWeb.Models.RequestModels;

public class AssignAgentModel
{
    [JsonPropertyName("agentId")] public int? AgentId { get; set; }

    [JsonPropertyName("jobId")] public int? JobId { get; set; }
}
