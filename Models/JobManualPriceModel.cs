using System.Text.Json.Serialization;
using DespatchWeb.Helpers;

namespace DespatchWeb.Models;

public sealed class JobManualPriceModel
{
    public int Id { get; init; }
    public decimal? Amount { get; init; }
    public decimal? RawBaseAmount { get; init; }
    public decimal? Fuel { get; init; }
    public decimal? Ppd { get; init; }
    public decimal? CourierPayment { get; init; }
    public decimal? CourierFuel { get; init; }
    public decimal? CourierBonus { get; init; }
    public string StatusName { get; init; }
    public string CourierCode { get; init; }

    [JsonConverter(typeof(StringToBooleanConverter))]
    public bool? Void { get; init; }
}