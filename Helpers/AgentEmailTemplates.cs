using System.Net;
using System.Text.RegularExpressions;

namespace DespatchWeb.Helpers;

/// <summary>
/// Hardcoded default templates for the inbound-agent assignment email, plus the token
/// substitution applied at send time. Tokens are written as <c>[FieldName]</c>; a dispatcher
/// may edit the template freely, so unknown tokens are left untouched rather than throwing,
/// and a null value renders empty.
/// </summary>
public static partial class AgentEmailTemplates
{
    public const string DefaultSubject = "New job assigned [JobNumber]";

    public const string DefaultBody =
        "Hi [AgentName]\n" +
        "\n" +
        "You have been assigned a new job [JobNumber]. This job is going to [DeliveryCompany] [DeliveryStreetNumber] [DeliveryStreetName] [DeliveryCity] Use the button below to accept the job and upload proof of delivery. [InboundUrl]\n" +
        "The flight is arriving on [FlightNumber] at [FlightETA] from [FromSuburbCity] with [Quantity] items weighing [Weight].\n" +
        "The delivery contact name is [DeliveryContactName] and you can call them on [DeliveryContactPhone].";

    // DFRNT brand tokens
    private const string InkBlue = "#0d0c2c"; // headings / strong text, and the on-colour for filled cyan
    private const string InkMuted = "#6e6d80"; // 60% Ink Blue — secondary / footer copy
    private const string Keyline = "#cfced5"; // 20% Ink Blue — divider lines
    private const string Cyan = "#3bc7f4"; // primary accent — CTA fill
    private const string LightGrey = "#f4f2f1"; // warm page background behind the card
    private const string ReflexBlue = "#2a4eff"; // secondary — inline text links (better contrast than cyan)

    private const string FontStack =
        "'DM Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private const string CtaLabel = "Accept job & upload POD →";

    /// <summary>
    /// Replaces every <c>[Token]</c> in <paramref name="template"/> with its value from
    /// <paramref name="tokens"/> (case-insensitive). Tokens with no matching entry are left
    /// verbatim so free-text edits never break sending
    /// </summary>
    public static string Substitute(string template, IReadOnlyDictionary<string, string> tokens) =>
        string.IsNullOrEmpty(template)
            ? string.Empty
            : TokenRegex().Replace(template, match =>
                tokens.TryGetValue(match.Groups[1].Value, out var value) ? value : match.Value);

    /// <summary>
    /// Renders an already-substituted plain-text body (with <c>\n</c> line breaks) into a
    /// DFRNT-branded, inline-styled HTML fragment for email. The dispatcher's editable template
    /// stays plain text; this is applied at send time because the external mailer sends the body
    /// as HTML, which would otherwise collapse the newlines onto one line.
    /// </summary>
    /// <remarks>
    /// All styling is inline (no <c>&lt;style&gt;</c> block, no <c>&lt;html&gt;/&lt;head&gt;</c>)
    /// for email-client compatibility. Text is HTML-escaped. The action link is lifted out of the
    /// body copy and rendered as a standalone pill CTA in its own section at the foot of the card,
    /// so it reads as the deliberate next step rather than an inline link in a sentence.
    /// The CTA is structural: when <paramref name="ctaUrl"/> is supplied it always renders,
    /// regardless of whether the (freely editable) body copy mentions the link. It falls back to
    /// scraping the first URL out of the body only when no explicit link is provided.
    /// </remarks>
    public static string RenderHtmlBody(string plainBody, string ctaUrl = null)
    {
        if (string.IsNullOrWhiteSpace(plainBody))
        {
            return string.Empty;
        }

        var normalised = plainBody.Replace("\r\n", "\n");

        // Prefer the explicit link; otherwise pull the first action link out of the copy. Either
        // way, bare URLs are stripped from the paragraphs so the CTA is never duplicated inline.
        ctaUrl = string.IsNullOrWhiteSpace(ctaUrl)
            ? UrlRegex().Match(normalised) is { Success: true } match ? match.Value : null
            : ctaUrl;

        var paragraphs = normalised
            .Split(["\n\n"], StringSplitOptions.None)
            .Select(p => StripUrls(p.Trim('\n')))
            .Where(p => p.Length > 0)
            .Select(RenderParagraph);

        var content = string.Join("\n", paragraphs);
        var ctaSection = ctaUrl is null ? string.Empty : RenderCtaSection(ctaUrl);

        return
            $"""
             <div style="background:{LightGrey};padding:24px;font-family:{FontStack};">
               <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 32px;">
                 {content}
             {ctaSection}
                 <div style="border-top:1px solid {Keyline};margin-top:24px;padding-top:16px;font-size:12px;color:{InkMuted};">
                   Powered by <strong style="color:{InkBlue};">Deliver DFRNT</strong> &middot; <a href="https://www.deliverdifferent.com" style="color:{ReflexBlue};text-decoration:none;">www.deliverdifferent.com</a>
                 </div>
               </div>
             </div>
             """;
    }

    /// <summary>
    /// Escapes one paragraph's text, converts single newlines to <c>&lt;br&gt;</c>, and wraps the
    /// result in a styled <c>&lt;p&gt;</c>. Action links are stripped upstream, so paragraphs are
    /// plain copy only.
    /// </summary>
    private static string RenderParagraph(string paragraph) =>
        $"""<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:{InkBlue};font-weight:400;">{EscapeWithBreaks(paragraph)}</p>""";

    private static string EscapeWithBreaks(string text) =>
        WebUtility.HtmlEncode(text).Replace("\n", "<br>");

    /// <summary>Removes any bare URLs from a paragraph and tidies the whitespace they leave behind.</summary>
    private static string StripUrls(string paragraph) =>
        WhitespaceRegex().Replace(UrlRegex().Replace(paragraph, string.Empty), " ").Trim();

    /// <summary>
    /// The dedicated CTA section: a keyline-separated, centred block with a small eyebrow label and
    /// the pill button, sitting between the body copy and the footer.
    /// </summary>
    private static string RenderCtaSection(string url) =>
        $"""
             <div style="border-top:1px solid {Keyline};margin-top:24px;padding-top:24px;text-align:center;">
               <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:{InkMuted};margin-bottom:14px;">Your next step</div>
               <a href="{WebUtility.HtmlEncode(url)}" style="display:inline-block;background:{Cyan};color:{InkBlue};font-weight:700;font-size:16px;text-decoration:none;padding:14px 30px;border-radius:999px;">{WebUtility.HtmlEncode(CtaLabel)}</a>
             </div>
         """;

    [GeneratedRegex(@"\[(\w+)\]")]
    private static partial Regex TokenRegex();

    [GeneratedRegex(@"https?://[^\s<]+")]
    private static partial Regex UrlRegex();

    // Horizontal whitespace only — newlines are preserved so single line breaks still become <br>.
    [GeneratedRegex(@"[^\S\r\n]{2,}")]
    private static partial Regex WhitespaceRegex();
}