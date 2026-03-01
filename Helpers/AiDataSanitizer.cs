using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

public static partial class AiDataSanitizer
{
    [GeneratedRegex(@"\b(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")]
    private static partial Regex EmailPattern();

    public static string Sanitize(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        var result = PhonePattern().Replace(input, "[PHONE]");
        result = EmailPattern().Replace(result, "[EMAIL]");
        return result;
    }
}
