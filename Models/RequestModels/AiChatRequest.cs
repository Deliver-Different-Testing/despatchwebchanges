using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class AiChatRequest
{
    public List<AiChatMessage> Messages { get; set; } = new();
    public string ConversationId { get; set; }
}

public class AiChatMessage
{
    public string Role { get; set; }
    public string Content { get; set; }
}
