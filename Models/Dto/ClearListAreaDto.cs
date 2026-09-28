namespace DespatchWeb.Models.Dto;

public sealed record ClearListAreaDto
{
    public int ClearListAreaId { get; init; }
    public string AreaName { get; init; }
    public int AreaOrder { get; init; }
}
