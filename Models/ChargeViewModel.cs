using System.ComponentModel.DataAnnotations;

namespace DespatchWeb.Models;

public sealed class ChargeViewModel
{
    public int ChargeId { get; init; }

    [Required(ErrorMessage = "Charge name is required")]
    [StringLength(100, ErrorMessage = "Charge name cannot exceed 100 characters")]
    public string Name { get; init; }
    public decimal Amount { get; init; }
    public int? JobId { get; init; }
    public int? PrebookJobId { get; init; }
    public decimal? CostAmount { get; init; }
    public int? ChildJobId { get; init; }
    public bool IsArchived { get; init; }
}

/// <summary>
/// Suggested fuel-surcharge revenue/cost for a manually-added price breakdown line,
/// computed from the job's actual fuel rate (UTL_fncMFV_FAF_Rates) and the vehicle
/// size's driver fuel percentage — mirrors how auto-computed charges apply fuel.
/// </summary>
public sealed class SuggestedFuelChargeViewModel
{
    public decimal FuelChargeAmount { get; init; }
    public decimal FuelCostAmount { get; init; }
}
