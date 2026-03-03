namespace DespatchWeb.Models.RequestModels;

public class DeletePriceComponentRequest
{
    public int JobId { get; init; }
    public int ChargeId { get; init; }
    public bool IsArchived { get; init; }
}