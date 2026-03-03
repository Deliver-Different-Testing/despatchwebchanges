namespace DespatchWeb.Models.Dto;

public class JobEventDto
{
    public string UcjbNumber { get; init; }
    public int? UcjbClientId { get; init; }
    public string UcjbContact { get; init; }
    public int? UcjbCourierId { get; init; }
    public int? UcjbSpeed { get; init; }
}