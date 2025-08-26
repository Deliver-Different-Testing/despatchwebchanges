using System;

namespace DespatchWeb.Helpers;

public static class ErrorMessageStringFormatter
{
    public static string Format(Exception exception) => $"{exception.Message} {exception.InnerException?.Message}";
    
    public static string FormatForLogging(Exception exception, string className, string functionName) =>
        $" Error occured in {className}/{functionName} -  {exception.Message}. InnerException: {exception.InnerException?.Message}";
}