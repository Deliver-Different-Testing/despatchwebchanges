#nullable enable
using System.Globalization;
using System.Text.Json;

namespace DespatchWeb.Services.AutoMate.Tools;

public static class ToolSchema
{
    public static JsonElement Prop(string type, string description) =>
        JsonSerializer.SerializeToElement(new { type, description });
}

public static class ToolOutput
{
    public const string StaffOnlyMessage = "This lookup is only available to staff users.";

    public static string Error(string message) => JsonSerializer.Serialize(new { error = message });

    public static bool IsError(string result) => result.StartsWith("{\"error\":", StringComparison.Ordinal);

    public static string Truncate(string value, int maxChars) =>
        value.Length <= maxChars ? value : $"{value[..maxChars]}…[truncated {value.Length - maxChars} chars]";
}

/// <summary>
/// Reads optional tool arguments without throwing on model-supplied bad input; the first
/// problem is recorded in <see cref="Error"/> so the tool can return it to the model.
/// </summary>
public sealed class ToolArgs(JsonElement input)
{
    public string? Error { get; private set; }

    public int? Int(string name)
    {
        if (!TryGet(name, out var element))
        {
            return null;
        }

        if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out var value))
        {
            return value;
        }

        Error ??= $"Argument '{name}' must be an integer.";
        return null;
    }

    public DateTime? Date(string name)
    {
        if (!TryGet(name, out var element))
        {
            return null;
        }

        if (element.ValueKind == JsonValueKind.String
            && DateTime.TryParse(element.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return parsed.Date;
        }

        Error ??= $"Argument '{name}' must be a date, e.g. 2026-11-02.";
        return null;
    }

    public string? String(string name)
    {
        if (!TryGet(name, out var element))
        {
            return null;
        }

        if (element.ValueKind == JsonValueKind.String)
        {
            return element.GetString();
        }

        Error ??= $"Argument '{name}' must be a string.";
        return null;
    }

    private bool TryGet(string name, out JsonElement element)
    {
        element = default;
        return input.ValueKind == JsonValueKind.Object
               && input.TryGetProperty(name, out element)
               && element.ValueKind != JsonValueKind.Null;
    }
}
