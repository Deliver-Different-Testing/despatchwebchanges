using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

public static partial class AiDataSanitizer
{
    // Phone-shaped only: international (+...), national with a leading 0, bracketed area code,
    // separated 3-3-4 groups, or an unseparated 10-digit run. Bare 6-9 digit runs are job and
    // consignment references and must survive.
    [GeneratedRegex(@"\+\d[\d\s().-]{7,}\d|\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b|\(\d{2,4}\)[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{10}\b")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")]
    private static partial Regex EmailPattern();

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
}
