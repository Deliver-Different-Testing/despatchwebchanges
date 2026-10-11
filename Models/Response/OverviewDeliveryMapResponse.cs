namespace DespatchWeb.Models.Response;

public sealed record OverviewDeliveryMapResponse
{
    public Coordinates Center { get; init; }
    public int Zoom { get; init; }
    public OverviewJobLocation Job { get; init; }

    public int SelectedJobIndex { get; init; }
}
