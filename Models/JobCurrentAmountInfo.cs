namespace DespatchWeb.Models;

public class JobCurrentAmountInfo
{
    public int JobId { get; init; }
    public string JobNo { get; init; }
    public decimal Amount { get; init; }
    public decimal RawBaseAmount { get; init; }
    public decimal Fuel { get; init; }
    public decimal Ppd { get; init; }
    public decimal CourierPayment { get; init; }
    public decimal CourierFuel { get; init; }
    public decimal CourierBonus { get; init; }
    public bool IsPrebook { get; init; }
}