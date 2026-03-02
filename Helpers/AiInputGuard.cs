using System.Linq;
using System.Text.RegularExpressions;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Helpers;

/// <summary>
/// Validates and sanitizes AI assistant inputs to prevent misuse,
/// prompt injection, and off-topic requests.
/// </summary>
public static partial class AiInputGuard
{
    private const int MaxMessageLength = 2000;
    private const int MaxConversationMessages = 40;
    private static readonly string[] AllowedRoles = ["user", "assistant"];

    /// <summary>
    /// Validates a chat request. Returns null if valid, or an error message string if invalid.
    /// </summary>
    public static string Validate(AiChatRequest request)
    {
        if (request?.Messages == null || request.Messages.Count == 0)
            return "At least one message is required.";

        if (request.Messages.Count > MaxConversationMessages)
            return $"Conversation exceeds the maximum of {MaxConversationMessages} messages. Please start a new conversation.";

        // The last message must be from the user
        var lastMessage = request.Messages[^1];
        if (lastMessage.Role != "user")
            return "The last message must be from the user.";

        foreach (var message in request.Messages)
        {
            if (string.IsNullOrWhiteSpace(message.Role) || !AllowedRoles.Contains(message.Role))
                return $"Invalid message role: '{message.Role}'. Allowed roles: user, assistant.";

            if (string.IsNullOrWhiteSpace(message.Content))
                return "Message content cannot be empty.";

            if (message.Content.Length > MaxMessageLength)
                return $"Message exceeds the maximum length of {MaxMessageLength} characters.";
        }

        // Check the user's latest message for injection attempts
        var latestUserContent = lastMessage.Content;
        return ContainsPromptInjection(latestUserContent) ? "Your message contains disallowed content. Please rephrase your question about dispatch operations." : null; // Valid
    }

    /// <summary>
    /// Detects common prompt injection patterns in user input.
    /// </summary>
    private static bool ContainsPromptInjection(string input)
    {
        var lower = input.ToLowerInvariant();

        // Detect attempts to override system instructions
        if (SystemOverridePattern().IsMatch(lower))
            return true;

        // Detect attempts to reveal system prompt
        return RevealPromptPattern().IsMatch(lower) ||
               // Detect roleplay / identity override attempts
               RoleplayPattern().IsMatch(lower);
    }

    /// <summary>
    /// Patterns attempting to override or ignore system instructions.
    /// </summary>
    [GeneratedRegex(
        @"(ignore\s+(all\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|context))|" +
        @"(disregard\s+(all\s+)?(previous|prior|above|system))|" +
        @"(forget\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|prompts))|" +
        @"(override\s+(system|your)\s+(prompt|instructions|rules))|" +
        @"(new\s+instructions?\s*:)|" +
        @"(system\s*:\s*you\s+are)|" +
        @"(\bdo\s+not\s+follow\s+(your|the|any)\s+(rules|instructions|guidelines)\b)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex SystemOverridePattern();

    /// <summary>
    /// Patterns attempting to extract the system prompt.
    /// </summary>
    [GeneratedRegex(
        @"(repeat\s+(your\s+)?(system\s+)?(prompt|instructions)\s*(back|verbatim|exactly)?)|" +
        @"(what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions|rules))|" +
        @"(show\s+me\s+your\s+(system\s+)?(prompt|instructions))|" +
        @"(print\s+(your\s+)?(system\s+)?(prompt|instructions))|" +
        @"(output\s+(your\s+)?(system\s+)?(prompt|instructions)\s*(in|as))",
        RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex RevealPromptPattern();

    /// <summary>
    /// Patterns attempting to make the AI assume a different role.
    /// </summary>
    [GeneratedRegex(
        @"(you\s+are\s+now\s+(a|an|no\s+longer))|" +
        @"(pretend\s+(to\s+be|you\s+are))|" +
        @"(act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+(?!dispatch|courier|logistics|delivery))|" +
        @"(roleplay\s+as)|" +
        @"(switch\s+to\s+.+\s+mode)|" +
        @"(enter\s+(developer|admin|debug|unrestricted|jailbreak)\s+mode)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex RoleplayPattern();
}
