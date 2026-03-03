namespace DespatchWeb.Models.RequestModels;

public class SimpleRepriceJobModel
{
    public int JobId { get; init; }
    public bool IsPrebook { get; init; }
    public bool IsBulk { get; init; }
    public decimal NewPrice { get; init; }
}