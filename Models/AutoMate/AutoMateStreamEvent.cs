#nullable enable
using System.Text.Json.Serialization;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Models.AutoMate;

public sealed class AutoMateStreamEvent
{
    public string Type { get; init; } = string.Empty;
    public string? Text { get; init; }
    public string? ToolName { get; init; }
    public string? Error { get; init; }

    /// <summary>Machine-readable reason for an error the UI shows differently, e.g. <c>not_connected</c>.</summary>
    public string? Code { get; init; }
    public IReadOnlyList<KbSource>? Sources { get; init; }

    /// <summary>Status to answer with when the error arrives before any output; never written into the stream.</summary>
    [JsonIgnore]
    public int? HttpStatus { get; init; }

    /// <summary>Tokens the whole turn used, carried on the done/error event for cost recording.</summary>
    [JsonIgnore]
    public AiUsageInfo? Usage { get; init; }
}
