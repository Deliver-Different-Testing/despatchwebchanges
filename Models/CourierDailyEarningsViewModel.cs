namespace DespatchWeb.Models;

public class CourierDailyEarningsViewModel
{
    public int CourierId { get; init; }
    public string Name { get; init; }
    public double HoursLogged { get; init; }
    public int Deliveries { get; init; }
    public decimal Earnings { get; init; }
    public decimal HourlyRate { get; init; }
}