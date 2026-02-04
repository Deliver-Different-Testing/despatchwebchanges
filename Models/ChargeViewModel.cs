using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public class ChargeViewModel
{
    public int ChargeId { get; set; }

    [Required(ErrorMessage = "Charge name is required")]
    [StringLength(100, ErrorMessage = "Charge name cannot exceed 100 characters")]
    public string Name { get; set; }
    public decimal Amount { get; set; }
    public int? JobId { get;set; }
    public int? PrebookJobId { get; set; }
    public decimal? CostAmount { get; set; }
    public int? ChildJobId { get; set; }
    public bool IsArchived { get; set; }
}
