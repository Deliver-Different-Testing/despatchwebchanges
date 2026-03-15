namespace DespatchWeb.Helpers;

public static class ErrorMessageStringFormatter
{
    /// <summary>
    /// Formats an exception for client-facing error responses.
    /// Returns generic message in production to prevent information disclosure.
    /// </summary>
    public static string Format(Exception exception) =>
        IsDevelopment()
            ? $"{exception.Message} {exception.InnerException?.Message}"
            : "An unexpected error occurred. Please try again or contact support.";

    /// <summary>
    /// Formats an exception for internal logging with class/function context.
    /// This should only be used in server logs, never returned to clients.
    /// </summary>
    public static string FormatForLogging(Exception exception, string className, string functionName) =>
        $" Error occurred in {className}/{functionName} -  {exception.Message}. InnerException: {exception.InnerException?.Message}";

    /// <summary>
    /// Only returns true in local development - never expose exception details in staging or production.
    /// </summary>
    private static bool IsDevelopment() =>
        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?.Equals("Development", StringComparison.OrdinalIgnoreCase) == true;
}