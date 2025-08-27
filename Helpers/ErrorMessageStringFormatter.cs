using System;
using System.Diagnostics;

namespace DespatchWeb.Helpers;

public static class ErrorMessageStringFormatter
{
    public static string Format(Exception exception) => Debugger.IsAttached
        ? $"{exception.Message} {exception.InnerException?.Message}"
        : "An unexpected error occurred. Please try again or contact support.";

    public static string FormatForLogging(Exception exception, string className, string functionName) =>
        $" Error occured in {className}/{functionName} -  {exception.Message}. InnerException: {exception.InnerException?.Message}";
}