namespace DespatchWeb.Models.Dto;

public sealed record PolygonChannelMapping
{
    public int ClearListAreaId { get; init; }
    public int? PolygonId { get; init; }
    public int? ZipPolygonId { get; init; }
    public int? ChannelId { get; init; }
}
