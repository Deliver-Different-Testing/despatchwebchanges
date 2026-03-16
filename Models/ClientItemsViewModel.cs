namespace DespatchWeb.Models;

public sealed class ClientItemsViewModel
{
    public int ItemId { get; init; }

    public int ClientId { get; init; }

    public string Name { get; init; }

    public string Description { get; init; }

    public bool PerItem { get; init; }

    public decimal Rate { get; init; }

    public int? VehicleSizeId { get; init; }

    public bool Selected { get; init; }
}
