using System;

namespace DespatchWeb.Helpers;

public static class ErrorMessageStringFormatter
{
    public static string Format(Exception exception) => $"{exception.Message} {exception.InnerException?.Message}";
}