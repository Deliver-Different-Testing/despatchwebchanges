namespace DespatchWeb.Models.RequestModels;

public class DeletePriceComponentRequest
{
    public int JobId { get; set; }
    public int ChargeId { get; set; }
    public bool IsArchived { get; set; }
}