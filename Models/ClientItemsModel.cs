using System.Collections.Generic;

namespace DespatchWeb.Models
{
    public class ClientItemsModel
    {
        public List<int> ServiceIds { get; set; }
        public decimal TotalCost { get; set; }
    }
}
