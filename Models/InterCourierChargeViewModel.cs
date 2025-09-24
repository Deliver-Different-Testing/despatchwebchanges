namespace DespatchWeb.Models;

public class InterCourierChargeViewModel
{
    public int FromCourierId { get; set; }
    public int ToCourierId { get; set; }
    public int ClientId { get; set; }
    public string Reference { get; set; }
    public decimal Amount { get; set; }
}