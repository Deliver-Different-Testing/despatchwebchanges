namespace DespatchWeb.Models.Ai;

public class AiMessage
{
    public string Role { get; init; } // "user" or "assistant"
    public string Content { get; init; }
}