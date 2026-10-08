#nullable enable
namespace DespatchWeb.Models.RequestModels;

public sealed class AssignNpAgentRequest
{
    public int? NpAgentId { get; init; }

    public int? JobId { get; init; }
}
