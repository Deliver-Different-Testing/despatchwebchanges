namespace DespatchWeb.Models;

public sealed class HereMapsStreetInfo
{
    public string BaseName { get; init; }
    public string StreetType { get; init; }
    public bool? StreetTypePrecedes { get; init; }
    public bool? StreetTypeAttached { get; init; }
    public string Prefix { get; init; }
    public string Suffix { get; init; }
    public string Direction { get; init; }
    public string Language { get; init; }
}
