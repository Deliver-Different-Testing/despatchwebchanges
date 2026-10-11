namespace DespatchWeb.Models;

public sealed class CreateCreateAheadBackfillDateError
{
    public DateOnly ServiceDate { get; init; }
    public string Message { get; init; } = string.Empty;
}
