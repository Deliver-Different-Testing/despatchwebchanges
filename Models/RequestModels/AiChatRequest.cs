namespace DespatchWeb.Models.RequestModels;

public sealed class AiChatRequest
{
    public List<AiChatMessage> Messages { get; init; } = [];
    public string ConversationId { get; init; }
}

public sealed class AiChatMessage
{
    public string Role { get; init; }
    public string Content { get; init; }
}
