namespace DespatchWeb.Models.Dto;

public class DisplayOrderDto
{
    public int CourierId { get; init; }
    public int? Status { get; init; }
    public DateTime? OrderTime { get; init; }
}
