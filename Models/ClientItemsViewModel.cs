namespace DespatchWeb.Models;

public class ClientItemsViewModel
{
    public int ItemId { get; set; }

    public int ClientId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public bool PerItem { get; set; }

    public decimal Rate { get; set; }

    public int? VehicleSizeId { get; set; }

    public bool Selected { get; set; }
}
