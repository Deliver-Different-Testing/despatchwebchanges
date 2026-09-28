namespace DespatchWeb.Models.Ai;

public class AiToolCall
{
    public string ToolUseId { get; set; }
    public string ToolName { get; init; }
    public string ArgumentsJson { get; init; }
}