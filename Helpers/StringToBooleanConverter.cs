using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DespatchWeb.Helpers;

/// <summary>
/// JSON converter that handles boolean values that may come as strings from Excel/CSV files.
/// Supports: "True", "False", "true", "false", "1", "0", 1, 0, true, false
/// </summary>
public sealed class StringToBooleanConverter : JsonConverter<bool?>
{
    public override bool? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.True:
                return true;
            case JsonTokenType.False:
                return false;
            case JsonTokenType.Null:
                return null;
            case JsonTokenType.String:
                var stringValue = reader.GetString();
                if (string.IsNullOrWhiteSpace(stringValue))
                    return null;

                // Handle common string representations
                if (stringValue.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                    stringValue.Equals("1", StringComparison.Ordinal) ||
                    stringValue.Equals("yes", StringComparison.OrdinalIgnoreCase))
                    return true;

                if (stringValue.Equals("false", StringComparison.OrdinalIgnoreCase) ||
                    stringValue.Equals("0", StringComparison.Ordinal) ||
                    stringValue.Equals("no", StringComparison.OrdinalIgnoreCase))
                    return false;

                return null;
            case JsonTokenType.Number:
                var numberValue = reader.GetInt32();
                return numberValue != 0;
            case JsonTokenType.None:
            case JsonTokenType.StartObject:
            case JsonTokenType.EndObject:
            case JsonTokenType.StartArray:
            case JsonTokenType.EndArray:
            case JsonTokenType.PropertyName:
            case JsonTokenType.Comment:
            default:
                return null;
        }
    }

    public override void Write(Utf8JsonWriter writer, bool? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
            writer.WriteBooleanValue(value.Value);
        else
            writer.WriteNullValue();
    }
}
