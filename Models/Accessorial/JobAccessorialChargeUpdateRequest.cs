namespace DespatchWeb.Models.Accessorial;

public class JobAccessorialChargeUpdateRequest
{
    public decimal? InputValue { get; set; }
    public int ItemCount { get; set; } = 1;
    public string Notes { get; set; }
    public decimal? OverrideAmount { get; set; }
}
