using Newtonsoft.Json;

namespace DespatchWeb.Models.RequestModels;

public class AssignAgentModel
{
    [JsonProperty("agentId")] public int? AgentId { get; set; }

    [JsonProperty("jobId")] public int? JobId { get; set; }
}
