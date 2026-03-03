namespace DespatchWeb.Models.Accessorial;

public class JobAccessorialChargeCreateRequest
{
    public int AccessorialChargeId { get; set; }
    public decimal? InputValue { get; set; }
    public int ItemCount { get; set; } = 1;
    public string Notes { get; set; }
}
