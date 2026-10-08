namespace DespatchWeb.Models;

public sealed class PolygonAreaMapping
{
    public int ClearListAreaId { get; set; }
    public string ClearListAreaName { get; set; }
    public int? AreaChannelId { get; set; }
    public bool ChannelMatches { get; set; }
}
