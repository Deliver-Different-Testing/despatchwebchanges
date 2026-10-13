#nullable enable
namespace DespatchWeb.Reporting;

public sealed record PriceChangeLogEntry(
    string JobNo,
    DateTimeOffset WhenLocal,
    string Who,
    string Field,
    string? Old,
    string? New);
