using System.Collections.Generic;

namespace DespatchWeb.Models;

public class ClientItemsModel
{
    public List<int> ServiceIds { get; init; }
    public decimal TotalCost { get; init; }
}