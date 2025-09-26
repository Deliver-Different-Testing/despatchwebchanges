namespace DespatchWeb.Models;

public class JobManualPriceModel
{
    public int Id { get; set; }
    public decimal? Amount { get; set; }
    public decimal? Fuel { get; set; }
    public decimal? Ppd { get; set; }
    public decimal? CourierPayment { get; set; }
    public decimal? CourierFuel { get; set; }
    public decimal? CourierBonus { get; set; }
    public string StatusName { get; set; }
}