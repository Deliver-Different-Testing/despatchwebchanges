using DespatchWeb.Helpers;

namespace DespatchWeb.Tests.Helpers;

public class ErrorMessageStringFormatterTests : IDisposable
{
    private readonly string? _originalEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

    public void Dispose() =>
        // Restore original environment after each test
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", _originalEnvironment ?? null);

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
        Assert.Contains("Test error message", result);
        Assert.Contains("Inner exception details", result);
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
        Assert.Equal("An unexpected error occurred. Please try again or contact support.", result);
        Assert.DoesNotContain("Sensitive", result);
        Assert.DoesNotContain("password", result);
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
        Assert.Equal("An unexpected error occurred. Please try again or contact support.", result);
        Assert.DoesNotContain("SQL", result);
        Assert.DoesNotContain("Stack trace", result);
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
        Assert.Equal("An unexpected error occurred. Please try again or contact support.", result);
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
        Assert.Contains("JobRepository", result);
        Assert.Contains("GetJobAsync", result);
        Assert.Contains("Database connection failed", result);
        Assert.Contains("Timeout expired", result);
        Assert.Contains("Error occurred in", result);
    }

    [Fact]
    public void FormatForLogging_WithNullInnerException_HandlesGracefully()
    {
        // Arrange
        var exception = new Exception("Simple error");

        // Act
        var result = ErrorMessageStringFormatter.FormatForLogging(exception, "TestClass", "TestMethod");

        // Assert
        Assert.Contains("TestClass", result);
        Assert.Contains("TestMethod", result);
        Assert.Contains("Simple error", result);
    }
}
