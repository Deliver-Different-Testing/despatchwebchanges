namespace DespatchWeb.Models;

public sealed class InterCourierChargeViewModel
{
    public int FromCourierId { get; init; }
    public int ToCourierId { get; init; }
    public string Reference { get; init; }
    public decimal Amount { get; init; }
}