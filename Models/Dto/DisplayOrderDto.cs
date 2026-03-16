namespace DespatchWeb.Models.Dto;

public sealed record DisplayOrderDto
{
    public int CourierId { get; init; }
    public int? Status { get; init; }
    public DateTime? OrderTime { get; init; }
}
