namespace DespatchWeb.Models.Response;

public sealed record Route
{
    public string Id { get; init; }
    public IReadOnlyList<Section> Sections { get; init; }
}
