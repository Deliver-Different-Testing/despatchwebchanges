namespace DespatchWeb.Models.Dto;

public sealed record SuburbClearListAreaDto
{
    public int SuburbId { get; init; }
    public int ClearListAreaId { get; init; }
    public string Code { get; init; }
    public int? ChannelId { get; init; }
}
