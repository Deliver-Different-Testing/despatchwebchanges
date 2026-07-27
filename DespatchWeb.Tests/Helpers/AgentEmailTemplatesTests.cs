using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

public class AgentEmailTemplatesRenderHtmlBodyTests
{
    [Fact]
    public void EmptyOrWhitespaceBody_ReturnsEmptyString()
    {
        Assert.Equal(string.Empty, AgentEmailTemplates.RenderHtmlBody(null));
        Assert.Equal(string.Empty, AgentEmailTemplates.RenderHtmlBody("   "));
    }

    [Fact]
    public void BlankLineSeparatedText_ProducesMultipleParagraphs()
    {
        var html = AgentEmailTemplates.RenderHtmlBody("First para\n\nSecond para");

        Assert.Equal(2, CountOccurrences(html, "<p "));
        Assert.Contains("First para", html);
        Assert.Contains("Second para", html);
    }

    [Fact]
    public void SingleNewlineWithinParagraph_BecomesLineBreak()
    {
        var html = AgentEmailTemplates.RenderHtmlBody("Line one\nLine two");

        Assert.Equal(1, CountOccurrences(html, "<p "));
        Assert.Contains("Line one<br>Line two", html);
    }

    [Fact]
    public void BareUrl_BecomesBrandedPillCtaButton()
    {
        var html = AgentEmailTemplates.RenderHtmlBody(
            "Please accept: https://inbound.example.com/TOKEN123");

        Assert.Contains("""<a href="https://inbound.example.com/TOKEN123""", html);
        Assert.Contains("Accept job &amp; upload POD", html); // CTA label (ampersand is escaped)
        Assert.Contains("background:#3bc7f4", html); // Cyan fill
        Assert.Contains("color:#0d0c2c", html); // Ink-Blue on-colour
        Assert.Contains("border-radius:999px", html); // pill shape
    }

    [Fact]
    public void ActionLink_IsLiftedOutOfCopyIntoOwnCtaSection()
    {
        var html = AgentEmailTemplates.RenderHtmlBody(
            "Use the button below to accept. https://inbound.example.com/TOKEN123");

        // The link is pulled out of the sentence: the paragraph keeps the copy but not the URL.
        Assert.Contains("Use the button below to accept.</p>", html);
        Assert.DoesNotContain("<p", html.Substring(html.IndexOf("https://", StringComparison.Ordinal)));

        // The CTA sits in its own keyline-separated section with a "Your next step" eyebrow,
        // after the body copy and before the footer.
        Assert.Contains("Your next step", html);
        var ctaIndex = html.IndexOf("Your next step", StringComparison.Ordinal);
        var copyIndex = html.IndexOf("Use the button below", StringComparison.Ordinal);
        var footerIndex = html.IndexOf("Powered by", StringComparison.Ordinal);
        Assert.True(copyIndex < ctaIndex && ctaIndex < footerIndex);
    }

    [Fact]
    public void UrlAtEndOfLine_DoesNotMergeTheFollowingLine()
    {
        // Mirrors the default body: the action link ends a line, the next sentence follows on its
        // own line. Stripping the URL must not swallow the line break between them.
        var html = AgentEmailTemplates.RenderHtmlBody(
            "Accept below. https://inbound.example.com/TOKEN\nThe flight is arriving soon.");

        Assert.Contains("<br>The flight is arriving soon.", html);
        Assert.DoesNotContain("Accept below. The flight", html); // sentences not merged
    }

    [Fact]
    public void NoActionLink_OmitsCtaSection()
    {
        var html = AgentEmailTemplates.RenderHtmlBody("Just some copy, no link here.");

        Assert.DoesNotContain("Your next step", html);
        Assert.DoesNotContain("border-radius:999px", html);
    }

    [Fact]
    public void TokenValueWithMarkupCharacters_IsHtmlEscaped()
    {
        var html = AgentEmailTemplates.RenderHtmlBody("Going to Smith & Co <HQ>");

        Assert.Contains("Smith &amp; Co &lt;HQ&gt;", html);
        Assert.DoesNotContain("<HQ>", html); // the raw tag must not survive
    }

    [Fact]
    public void Output_ContainsPoweredByDeliverDfrntFooter()
    {
        var html = AgentEmailTemplates.RenderHtmlBody("Hi there");

        Assert.Contains("Powered by", html);
        Assert.Contains("Deliver DFRNT", html);
        Assert.Contains("deliverdifferent.com", html);
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = haystack.IndexOf(needle, index, StringComparison.Ordinal)) != -1)
        {
            count++;
            index += needle.Length;
        }

        return count;
    }
}