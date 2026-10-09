namespace DespatchWeb.Models;

public sealed class ClearListEnvelopeViewModel
{
    public decimal MinimumLatitude { get; init; }
    public decimal MinimumLongitude { get; init; }
    public decimal MaximumLatitude { get; init; }
    public decimal MaximumLongitude { get; init; }
}
