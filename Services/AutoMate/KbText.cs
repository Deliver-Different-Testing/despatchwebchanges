#nullable enable
namespace DespatchWeb.Services.AutoMate;

internal static class KbText
{
    private const int ArticleLength = 6000;
    private const int LeadLength = 500;
    private const int MinLeadLength = 150;

    public const string UnavailableMessage =
        "The help knowledge base is unavailable right now. Answer from your own knowledge and say help articles couldn't be checked.";

    /// <summary>Strips angle brackets (so article text can't close the block it sits in) and control characters.</summary>
    public static string Clean(string? text) =>
        string.IsNullOrEmpty(text)
            ? string.Empty
            : new string(text.Select(c => c is '<' or '>' || (char.IsControl(c) && c is not ('\n' or '\r' or '\t')) ? ' ' : c).ToArray());

    public static string Article(string? text)
    {
        var flat = Clean(text).Trim();
        return flat.Length <= ArticleLength ? flat : flat[..ArticleLength] + "…";
    }

    public static string Lead(string? text)
    {
        var flat = Clean(text).Trim();
        var paragraphEnd = flat.IndexOf('\n');
        if (paragraphEnd > 0)
        {
            flat = flat[..paragraphEnd].TrimEnd();
        }

        if (flat.Length <= LeadLength)
        {
            return flat;
        }

        var window = flat[..LeadLength];
        var sentenceEnd = Math.Max(window.LastIndexOf(". ", StringComparison.Ordinal), window.LastIndexOf("? ", StringComparison.Ordinal));
        return sentenceEnd >= MinLeadLength ? window[..(sentenceEnd + 1)] : window + "…";
    }
}
