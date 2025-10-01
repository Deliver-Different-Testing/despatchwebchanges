namespace DespatchWeb.Models.Dto;

public class JobEventDto
{
    public string UcjbNumber { get; set; }
    public int? UcjbClientId { get; set; }
    public string UcjbContact { get; set; }
    public int? UcjbCourierId { get; set; }
    public int? UcjbSpeed { get; set; }
}