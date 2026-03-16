namespace DespatchWeb.Models;

public sealed class ClientItemsModel
{
    public List<int> ServiceIds { get; init; }
    public decimal TotalCost { get; init; }
}