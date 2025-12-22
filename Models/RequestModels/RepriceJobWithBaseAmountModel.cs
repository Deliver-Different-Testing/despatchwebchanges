namespace DespatchWeb.Models.RequestModels;

public class RepriceJobWithBaseAmountModel
{
    public int JobId { get; set; }
    public bool IsPrebook { get; set; }
    public decimal BaseAmount { get; set; }
}
