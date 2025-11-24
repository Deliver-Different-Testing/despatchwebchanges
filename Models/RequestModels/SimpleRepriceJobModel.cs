namespace DespatchWeb.Models.RequestModels;

public class SimpleRepriceJobModel
{
    public int JobId { get; set; }
    public bool IsPrebook { get; set; }
    public decimal NewPrice { get; set; }
}