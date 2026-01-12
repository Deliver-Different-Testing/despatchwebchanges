namespace DespatchWeb.Models;

public class ChargeViewModel
{
    public int ChargeId { get; set; }
    public string Name { get; set; }
    public decimal Amount { get; set; }
    public int? JobId { get;set; }
    public int? PrebookJobId { get; set; }
    public decimal? CostAmount { get; set; }
    public int? ChildJobId { get; set; }
    public bool IsArchived { get; set; }
}
