using System;

namespace DespatchWeb.Helpers;

public static class ErrorMessageStringFormatter
{
    public static string Format(Exception exception) =>
        IsDevelopment()
            ? $"{exception.Message} {exception.InnerException?.Message}"
            : "An unexpected error occurred. Please try again or contact support.";

    public static string FormatForLogging(Exception exception, string className, string functionName) =>
        $" Error occured in {className}/{functionName} -  {exception.Message}. InnerException: {exception.InnerException?.Message}";

    private static bool IsDevelopment() =>
        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?.Equals("Development", StringComparison.OrdinalIgnoreCase) == true ||
        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?.Equals("Staging", StringComparison.OrdinalIgnoreCase) == true;
}