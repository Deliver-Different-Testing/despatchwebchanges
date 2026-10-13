namespace DespatchWeb.Models;

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
