namespace DespatchWeb.Models;

public class JobCurrentAmountInfo
{
    public int JobId { get; set; }
    public string JobNo { get; set; }
    public decimal Amount { get; set; }
    public decimal RawBaseAmount { get; set; }
    public decimal Fuel { get; set; }
    public decimal Ppd { get; set; }
    public decimal CourierPayment { get; set; }
    public decimal CourierFuel { get; set; }
    public decimal CourierBonus { get; set; }
    public bool IsPrebook { get; set; }
}