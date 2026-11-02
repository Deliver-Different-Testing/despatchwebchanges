#nullable enable
namespace DespatchWeb.Models.AutoMate;

public sealed class AutoMateChatRequest
{
    public List<AutoMateChatMessage> Messages { get; init; } = [];
    public string? PageContext { get; init; }
}

public sealed class AutoMateChatMessage
{
    public string Role { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
}
