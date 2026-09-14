using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

/// <summary>
/// Text whose phone numbers and emails have been replaced by indexed placeholders,
/// together with the map that puts them back. Used where the model's output carries
/// the placeholders through into a field the operator will read — see
/// <see cref="AiDataSanitizer.Restore"/>.
/// </summary>
public sealed record SanitizedText(string Text, IReadOnlyDictionary<string, string> Placeholders);

public static partial class AiDataSanitizer
{
    [GeneratedRegex(@"\b(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")]
    private static partial Regex EmailPattern();

    private static readonly IReadOnlyDictionary<string, string> NoPlaceholders =
        new Dictionary<string, string>(StringComparer.Ordinal);

    public static string Sanitize(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return input;
        }

        var result = PhonePattern().Replace(input, "[PHONE]");
        result = EmailPattern().Replace(result, "[EMAIL]");
        return result;
    }

    /// <summary>
    /// Redacts the same values as <see cref="Sanitize"/>, but to numbered placeholders
    /// the model can carry through into its answer and <see cref="Restore"/> can undo.
    /// Use this where a redacted value has to survive into something the operator reads
    /// — a booking note saying "call Jo on 021 555 1234" is worthless as "[PHONE]".
    /// </summary>
    public static SanitizedText SanitizeWithTokens(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return new SanitizedText(input, NoPlaceholders);
        }

        var placeholders = new Dictionary<string, string>(StringComparer.Ordinal);

        // Email before phone, unlike Sanitize: an address with enough digits in its
        // local part is half-eaten by the phone pattern and then never matches as an
        // email at all.
        var result = Tokenize(input, EmailPattern(), "EMAIL", placeholders);
        result = Tokenize(result, PhonePattern(), "PHONE", placeholders);

        return new SanitizedText(result, placeholders);
    }

    /// <summary>
    /// Substitutes the original values back in wherever their placeholder appears.
    /// A placeholder the map does not know is left alone rather than blanked, so a
    /// token the model invented stays visible to the operator instead of vanishing.
    /// </summary>
    public static string Restore(string input, IReadOnlyDictionary<string, string> placeholders)
    {
        if (string.IsNullOrEmpty(input) || placeholders is not { Count: > 0 })
        {
            return input;
        }

        foreach (var (token, original) in placeholders)
        {
            input = input.Replace(token, original, StringComparison.Ordinal);
        }

        return input;
    }

    private static string Tokenize(
        string input,
        Regex pattern,
        string kind,
        Dictionary<string, string> placeholders)
    {
        var assigned = new Dictionary<string, string>(StringComparer.Ordinal);

        return pattern.Replace(input, match =>
        {
            if (assigned.TryGetValue(match.Value, out var existing))
            {
                return existing;
            }

            var token = $"[{kind}_{assigned.Count + 1}]";
            assigned[match.Value] = token;
            placeholders[token] = match.Value;
            return token;
        });
    }
}
