using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

public class AiDataSanitizerTests
{
    [Fact]
    public void Sanitize_NullInput_ReturnsNull() => Assert.Null(AiDataSanitizer.Sanitize(null));

    [Fact]
    public void Sanitize_EmptyInput_ReturnsEmpty() => Assert.Empty(AiDataSanitizer.Sanitize(string.Empty)!);

    [Fact]
    public void Sanitize_NoSensitiveData_ReturnsUnchanged()
    {
        const string input = "Job 12345 delivered to 10 Main Street";
        Assert.Equal(input, AiDataSanitizer.Sanitize(input));
    }

    [Fact]
    public void Sanitize_EmailAddress_ReplacesWithToken()
    {
        const string input = "Contact john.doe@example.com for details";
        var result = AiDataSanitizer.Sanitize(input);
        Assert.Contains("[EMAIL]", result);
        Assert.DoesNotContain("john.doe@example.com", result);
    }

    [Fact]
    public void Sanitize_PhoneNumber_ReplacesWithToken()
    {
        const string input = "Call 021-555-1234 for pickup";
        var result = AiDataSanitizer.Sanitize(input);
        Assert.Contains("[PHONE]", result);
        Assert.DoesNotContain("021-555-1234", result);
    }

    [Fact]
    public void Sanitize_MultipleEmailsAndPhones_ReplacesAll()
    {
        const string input = "Email test@foo.com or backup@bar.org, phone 09 555 1234";
        var result = AiDataSanitizer.Sanitize(input);
        Assert.DoesNotContain("test@foo.com", result);
        Assert.DoesNotContain("backup@bar.org", result);
    }

    [Fact]
    public void Sanitize_MixedContent_PreservesNonSensitiveText()
    {
        const string input = "Job 100 note: contact admin@test.com about delivery";
        var result = AiDataSanitizer.Sanitize(input);
        Assert.Contains("Job 100 note:", result);
        Assert.Contains("about delivery", result);
        Assert.Contains("[EMAIL]", result);
    }

    // ---- SanitizeWithTokens / Restore -------------------------------------

    [Fact]
    public void SanitizeWithTokens_NullInput_ReturnsNullTextAndEmptyMap()
    {
        var result = AiDataSanitizer.SanitizeWithTokens(null);
        Assert.Null(result.Text);
        Assert.Empty(result.Placeholders);
    }

    [Fact]
    public void SanitizeWithTokens_NoSensitiveData_ReturnsUnchangedAndEmptyMap()
    {
        const string input = "Pick up from 10 Main Street before 3pm";
        var result = AiDataSanitizer.SanitizeWithTokens(input);
        Assert.Equal(input, result.Text);
        Assert.Empty(result.Placeholders);
    }

    [Fact]
    public void SanitizeWithTokens_IndexesEachDistinctValue()
    {
        const string input = "Call 021-555-1234, or if no answer try 09 555 9999";
        var result = AiDataSanitizer.SanitizeWithTokens(input);

        Assert.Contains("[PHONE_1]", result.Text);
        Assert.Contains("[PHONE_2]", result.Text);
        Assert.DoesNotContain("021-555-1234", result.Text);
        Assert.DoesNotContain("09 555 9999", result.Text);
        Assert.Equal("021-555-1234", result.Placeholders["[PHONE_1]"]);
        Assert.Equal("09 555 9999", result.Placeholders["[PHONE_2]"]);
    }

    [Fact]
    public void SanitizeWithTokens_RepeatedValue_ReusesTheSameToken()
    {
        const string input = "Call 021-555-1234 on arrival. 021-555-1234 is the site number.";
        var result = AiDataSanitizer.SanitizeWithTokens(input);

        Assert.Single(result.Placeholders);
        Assert.DoesNotContain("[PHONE_2]", result.Text);
    }

    [Fact]
    public void SanitizeWithTokens_EmailKeepsItsOwnSequence()
    {
        const string input = "Email jo@example.com and pat@example.org, phone 09 555 1234";
        var result = AiDataSanitizer.SanitizeWithTokens(input);

        Assert.Equal("jo@example.com", result.Placeholders["[EMAIL_1]"]);
        Assert.Equal("pat@example.org", result.Placeholders["[EMAIL_2]"]);
        Assert.Equal("09 555 1234", result.Placeholders["[PHONE_1]"]);
    }

    [Fact]
    public void SanitizeWithTokens_EmailIsMatchedBeforePhone()
    {
        const string input = "Email jo1234567@example.com about it";
        var result = AiDataSanitizer.SanitizeWithTokens(input);

        Assert.Equal("jo1234567@example.com", result.Placeholders["[EMAIL_1]"]);
        Assert.DoesNotContain("[PHONE", result.Text);
    }

    [Fact]
    public void Restore_PutsTheOriginalValuesBack()
    {
        const string input = "Call 021-555-1234 or email jo@example.com";
        var sanitized = AiDataSanitizer.SanitizeWithTokens(input);

        Assert.Equal(input, AiDataSanitizer.Restore(sanitized.Text, sanitized.Placeholders));
    }

    [Fact]
    public void Restore_RestoresTokensReachingItFromModelOutput()
    {
        var sanitized = AiDataSanitizer.SanitizeWithTokens("Call 021-555-1234 before delivery");
        var modelOutput = $"Call {sanitized.Placeholders.Keys.First()} before delivery, ask for Jo";

        Assert.Equal(
            "Call 021-555-1234 before delivery, ask for Jo",
            AiDataSanitizer.Restore(modelOutput, sanitized.Placeholders));
    }

    [Fact]
    public void Restore_UnknownTokenIsLeftAlone()
    {
        var map = AiDataSanitizer.SanitizeWithTokens("Call 09 555 1234").Placeholders;
        Assert.Equal("Call [PHONE_9]", AiDataSanitizer.Restore("Call [PHONE_9]", map));
    }

    [Fact]
    public void Restore_NullOrEmptyInput_ReturnsInputUnchanged()
    {
        var map = AiDataSanitizer.SanitizeWithTokens("Call 09 555 1234").Placeholders;
        Assert.Null(AiDataSanitizer.Restore(null, map));
        Assert.Empty(AiDataSanitizer.Restore(string.Empty, map));
    }
}
