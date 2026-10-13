namespace DespatchWeb.Models.Response;

public sealed record CourierLocation
{
    public int CourierId { get; init; }
    public string CourierName { get; init; }
    public Coordinates? Coordinates { get; init; }
}
