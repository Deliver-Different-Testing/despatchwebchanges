namespace DespatchWeb.Models.RequestModels;

public sealed class CourierLocationRequest
{
    public decimal MinLng { get; init; }

    public decimal MinLat { get; init; }

    public decimal MaxLng { get; init; }

    public decimal MaxLat { get; init; }
}
