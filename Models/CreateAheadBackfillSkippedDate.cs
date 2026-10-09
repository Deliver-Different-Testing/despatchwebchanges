namespace DespatchWeb.Models;

public sealed class CreateAheadBackfillSkippedDate
{
    public DateOnly ServiceDate { get; init; }
    public string Reason { get; init; } = string.Empty;
}
