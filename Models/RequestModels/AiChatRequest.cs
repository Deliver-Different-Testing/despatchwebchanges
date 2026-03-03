using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AiChatRequest
{
    public List<AiChatMessage> Messages { get; init; } = [];
    public string ConversationId { get; init; }
}

public class AiChatMessage
{
    public string Role { get; init; }
    public string Content { get; init; }
}
