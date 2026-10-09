namespace DespatchWeb.Models;

public sealed class Compliance
{
    public bool? DangerousGoods { get; init; }
    public DateTime? DangerousGoodsExpiry { get; init; }
    public DateTime? DriversLicenceExpiry { get; init; }
}
