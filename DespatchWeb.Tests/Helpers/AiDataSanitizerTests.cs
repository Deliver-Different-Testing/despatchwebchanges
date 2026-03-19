using DespatchWeb.Helpers;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

public class AiDataSanitizerTests
{
    [Fact]
    public void Sanitize_NullInput_ReturnsNull() => AiDataSanitizer.Sanitize(null).Should().BeNull();

    [Fact]
    public void Sanitize_EmptyInput_ReturnsEmpty() => AiDataSanitizer.Sanitize(string.Empty).Should().BeEmpty();

    [Fact]
    public void Sanitize_NoSensitiveData_ReturnsUnchanged()
    {
        const string input = "Job 12345 delivered to 10 Main Street";
        AiDataSanitizer.Sanitize(input).Should().Be(input);
    }

    [Fact]
    public void Sanitize_EmailAddress_ReplacesWithToken()
    {
        const string input = "Contact john.doe@example.com for details";
        var result = AiDataSanitizer.Sanitize(input);
        result.Should().Contain("[EMAIL]");
        result.Should().NotContain("john.doe@example.com");
    }

    [Fact]
    public void Sanitize_PhoneNumber_ReplacesWithToken()
    {
        const string input = "Call 021-555-1234 for pickup";
        var result = AiDataSanitizer.Sanitize(input);
        result.Should().Contain("[PHONE]");
        result.Should().NotContain("021-555-1234");
    }

    [Fact]
    public void Sanitize_MultipleEmailsAndPhones_ReplacesAll()
    {
        const string input = "Email test@foo.com or backup@bar.org, phone 09 555 1234";
        var result = AiDataSanitizer.Sanitize(input);
        result.Should().NotContain("test@foo.com");
        result.Should().NotContain("backup@bar.org");
    }

    [Fact]
    public void Sanitize_MixedContent_PreservesNonSensitiveText()
    {
        const string input = "Job 100 note: contact admin@test.com about delivery";
        var result = AiDataSanitizer.Sanitize(input);
        result.Should().Contain("Job 100 note:");
        result.Should().Contain("about delivery");
        result.Should().Contain("[EMAIL]");
    }
}