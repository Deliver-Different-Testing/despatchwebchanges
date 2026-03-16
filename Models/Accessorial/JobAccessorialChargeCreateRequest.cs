namespace DespatchWeb.Models.Accessorial;

public sealed class JobAccessorialChargeCreateRequest
{
    public int AccessorialChargeId { get; init; }
    public decimal? InputValue { get; init; }
    public int ItemCount { get; init; } = 1;
    public string Notes { get; init; }
}
