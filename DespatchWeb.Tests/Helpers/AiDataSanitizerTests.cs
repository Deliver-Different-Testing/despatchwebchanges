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
}
