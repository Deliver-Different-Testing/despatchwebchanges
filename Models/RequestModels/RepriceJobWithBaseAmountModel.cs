namespace DespatchWeb.Models.RequestModels;

public sealed class RepriceJobWithBaseAmountModel
{
    public int JobId { get; init; }
    public bool IsPrebook { get; init; }
    public decimal BaseAmount { get; init; }
}
