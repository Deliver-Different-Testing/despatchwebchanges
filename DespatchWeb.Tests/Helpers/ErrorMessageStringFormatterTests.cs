using DespatchWeb.Helpers;
using FluentAssertions;

namespace DespatchWeb.Tests.Helpers;

public class ErrorMessageStringFormatterTests : IDisposable
{
    private readonly string? _originalEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

    public void Dispose()
    {
        // Restore original environment after each test
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", _originalEnvironment ?? null);
    }

    [Fact]
    public void Format_InDevelopment_ReturnsDetailedMessage()
    {
        // Arrange
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
        var exception = new InvalidOperationException("Test error message",
            new Exception("Inner exception details"));

        // Act
        var result = ErrorMessageStringFormatter.Format(exception);

        // Assert
        result.Should().Contain("Test error message");
        result.Should().Contain("Inner exception details");
    }

    [Fact]
    public void Format_InStaging_ReturnsGenericMessage()
    {
        // Arrange - This is the security fix: staging should NOT show details
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Staging");
        var exception = new InvalidOperationException("Sensitive database error",
            new Exception("Connection string: server=prod;password=secret"));

        // Act
        var result = ErrorMessageStringFormatter.Format(exception);

        // Assert
        result.Should().Be("An unexpected error occurred. Please try again or contact support.");
        result.Should().NotContain("Sensitive");
        result.Should().NotContain("password");
    }

    [Fact]
    public void Format_InProduction_ReturnsGenericMessage()
    {
        // Arrange
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
        var exception = new InvalidOperationException("SQL injection attempt detected",
            new Exception("Stack trace with internal paths"));

        // Act
        var result = ErrorMessageStringFormatter.Format(exception);

        // Assert
        result.Should().Be("An unexpected error occurred. Please try again or contact support.");
        result.Should().NotContain("SQL");
        result.Should().NotContain("Stack trace");
    }

    [Fact]
    public void Format_WithNoEnvironmentSet_ReturnsGenericMessage()
    {
        // Arrange - Null/unset environment should default to secure behavior
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", null);
        var exception = new Exception("Internal error");

        // Act
        var result = ErrorMessageStringFormatter.Format(exception);

        // Assert
        result.Should().Be("An unexpected error occurred. Please try again or contact support.");
    }

    [Fact]
    public void FormatForLogging_ReturnsFullDetailsWithContext()
    {
        // Arrange - Logging format should always include full details (for server logs only)
        var exception = new InvalidOperationException("Database connection failed",
            new Exception("Timeout expired"));

        // Act
        var result = ErrorMessageStringFormatter.FormatForLogging(exception, "JobRepository", "GetJobAsync");

        // Assert
        result.Should().Contain("JobRepository");
        result.Should().Contain("GetJobAsync");
        result.Should().Contain("Database connection failed");
        result.Should().Contain("Timeout expired");
        result.Should().Contain("Error occurred in");
    }

    [Fact]
    public void FormatForLogging_WithNullInnerException_HandlesGracefully()
    {
        // Arrange
        var exception = new Exception("Simple error");

        // Act
        var result = ErrorMessageStringFormatter.FormatForLogging(exception, "TestClass", "TestMethod");

        // Assert
        result.Should().Contain("TestClass");
        result.Should().Contain("TestMethod");
        result.Should().Contain("Simple error");
    }
}
