namespace DespatchWeb.Models;

public readonly record struct Lookup
{
    public int Id { get; init; }
    public string Text { get; init; }
}
