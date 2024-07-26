namespace DespatchWeb.Models;

public class InterCourierChargeViewModel
{
    public int FromCourierId { get; set; }
    public int ToCourierId { get; set; }
    public string Reference { get; set; }
    public int Zones { get; set; }
    public double Amount { get; set; }
    public int StaffId { get; set; }
}