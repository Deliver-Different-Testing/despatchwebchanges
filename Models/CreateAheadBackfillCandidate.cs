namespace DespatchWeb.Models;

public sealed class CreateAheadBackfillCandidate
{
    // Calendar date only. Serialised as YYYY-MM-DD via the .NET 8 built-in
    // DateOnlyJsonConverter so no UTC round-trip on the wire.
    public DateOnly ServiceDate { get; init; }

    // Convenience label for the UI: e.g. "Mon 21 Jul".
    public string DisplayLabel { get; init; } = string.Empty;
}
