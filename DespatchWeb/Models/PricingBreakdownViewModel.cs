namespace DespatchWeb.Models;

public class PricingBreakdownViewModel
{
    public int PricingBreakDownId { get; set; }
    public int JobId { get; set; }

    public string ChargeName { get; set; }
    public decimal ChargeAmount { get; set; }

    public decimal TotalCharge { get; set; }
}