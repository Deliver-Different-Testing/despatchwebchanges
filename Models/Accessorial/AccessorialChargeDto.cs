namespace DespatchWeb.Models.Accessorial;

public sealed record AccessorialChargeDto
{
    public int AccessorialChargeId { get; init; }
    public string Name { get; init; }
    public string Description { get; init; }
    public string ChargeType { get; init; }
    public int? UnitTypeId { get; init; }
    public string UnitTypeName { get; init; }
    public decimal? BaseRate { get; init; }
    public decimal? RatePerUnit { get; init; }
    public decimal? PercentageRate { get; init; }
    public decimal? MinimumCharge { get; init; }
    public decimal? MaximumCharge { get; init; }
    public decimal? MinimumQuantity { get; init; }
    public decimal? FreeAllowance { get; init; }
    public int? FreeAllowanceUnitTypeId { get; init; }
    public string FreeAllowanceUnitTypeName { get; init; }
    public string ConditionalNote { get; init; }
    public int CalculationOrder { get; init; }
    public bool AlreadyApplied { get; init; }
}
