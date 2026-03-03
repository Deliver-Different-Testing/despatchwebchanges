namespace DespatchWeb.Models.Accessorial;

public class JobAccessorialChargeUpdateRequest
{
    public decimal? InputValue { get; init; }
    public int ItemCount { get; init; } = 1;
    public string Notes { get; init; }
    public decimal? OverrideAmount { get; init; }
}
