namespace DespatchWeb.Models;

public sealed class HereMapsLookupResponse
{
    public string Title { get; init; }
    public string Id { get; init; }
    public string Language { get; init; }
    public string ResultType { get; init; }
    public Address Address { get; init; }
    public Position Position { get; init; }
    public List<HereMapsStreetInfo> StreetInfo { get; init; }
}
