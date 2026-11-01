namespace DespatchWeb.Models.AutoMate;

public sealed class AutoMateChatOptions
{
    public const string SectionName = "AutoMateChat";

    public int MaxConversationMessages { get; init; } = 40;
    public int MaxToolRounds { get; init; } = 4;
    public int MaxToolCallsPerTurn { get; init; } = 10;
    public int MaxToolResultChars { get; init; } = 12000;
    public int MaxMessageChars { get; init; } = 8000;
    public int MaxPageContextChars { get; init; } = 200;
    public int GroundingTimeoutMs { get; init; } = 2000;
    public int KbToolTimeoutMs { get; init; } = 5000;
}
