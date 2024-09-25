namespace DespatchWeb.Models;

public class CourierClearListViewModel
{
    public int CourierID { get; set; }

    [EntityClasses.PropName("#")] public string CourierCode { get; set; }

    public int DisplayOrder { get; set; }

    public string Deliver { get; set; }
}