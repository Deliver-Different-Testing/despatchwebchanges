namespace DespatchWeb.Models.Accessorial;

public record JobAccessorialChargeDto
{
    public int JobAccessorialChargeId { get; init; }
    public int JobId { get; init; }
    public int AccessorialChargeId { get; init; }
    public string Name { get; init; }
    public string ChargeType { get; init; }
    public int? UnitTypeId { get; init; }
    public string UnitTypeName { get; init; }
    public decimal? BaseRate { get; init; }
    public decimal? RatePerUnit { get; init; }
    public decimal? PercentageRate { get; init; }
    public decimal? FreeAllowance { get; init; }
    public string FreeAllowanceUnitTypeName { get; init; }
    public decimal? MinimumQuantity { get; init; }
    public decimal? MinimumCharge { get; init; }
    public decimal? MaximumCharge { get; init; }
    public decimal? InputValue { get; init; }
    public int ItemCount { get; init; }
    public decimal? CalculatedAmount { get; init; }
    public decimal? OverrideAmount { get; init; }
    public int CalculationOrder { get; init; }
    public string Notes { get; init; }
    public string AddedAtStage { get; init; }
    public string CreatedBy { get; init; }
    public DateTime? Created { get; init; }
}
