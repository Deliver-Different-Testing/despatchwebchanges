using System.Text.Json.Serialization;
using DespatchWeb.Helpers;

namespace DespatchWeb.Models;

public class JobManualPriceModel
{
    public int Id { get; set; }
    public decimal? Amount { get; set; }
    public decimal? RawBaseAmount { get; set; }
    public decimal? Fuel { get; set; }
    public decimal? Ppd { get; set; }
    public decimal? CourierPayment { get; set; }
    public decimal? CourierFuel { get; set; }
    public decimal? CourierBonus { get; set; }
    public string StatusName { get; set; }
    public string CourierCode { get; set; }

    [JsonConverter(typeof(StringToBooleanConverter))]
    public bool? Void { get; set; }
}