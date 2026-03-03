using System;

namespace DespatchWeb.Models.Accessorial;

public class JobAccessorialChargeDto
{
    public int JobAccessorialChargeId { get; set; }
    public int JobId { get; set; }
    public int AccessorialChargeId { get; set; }
    public string Name { get; set; }
    public string ChargeType { get; set; }
    public int? UnitTypeId { get; set; }
    public string UnitTypeName { get; set; }
    public decimal? BaseRate { get; set; }
    public decimal? RatePerUnit { get; set; }
    public decimal? PercentageRate { get; set; }
    public decimal? FreeAllowance { get; set; }
    public string FreeAllowanceUnitTypeName { get; set; }
    public decimal? MinimumQuantity { get; set; }
    public decimal? MinimumCharge { get; set; }
    public decimal? MaximumCharge { get; set; }
    public decimal? InputValue { get; set; }
    public int ItemCount { get; set; }
    public decimal? CalculatedAmount { get; set; }
    public decimal? OverrideAmount { get; set; }
    public int CalculationOrder { get; set; }
    public string Notes { get; set; }
    public string AddedAtStage { get; set; }
    public string CreatedBy { get; set; }
    public DateTime? Created { get; set; }
}
