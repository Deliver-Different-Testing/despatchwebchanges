namespace DespatchWeb.Models;

public class CourierDailyEarningsViewModel
{
    public int CourierId { get; set; }
    public string Name { get; set; }
    public double HoursLogged { get; set; }
    public int Deliveries { get; set; }
    public decimal Earnings { get; set; }
    public decimal HourlyRate { get; set; }
}