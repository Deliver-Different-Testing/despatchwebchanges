namespace DespatchWeb.Models.Accessorial;

public class AccessorialChargeDto
{
    public int AccessorialChargeId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string ChargeType { get; set; }
    public int? UnitTypeId { get; set; }
    public string UnitTypeName { get; set; }
    public decimal? BaseRate { get; set; }
    public decimal? RatePerUnit { get; set; }
    public decimal? PercentageRate { get; set; }
    public decimal? MinimumCharge { get; set; }
    public decimal? MaximumCharge { get; set; }
    public decimal? MinimumQuantity { get; set; }
    public decimal? FreeAllowance { get; set; }
    public int? FreeAllowanceUnitTypeId { get; set; }
    public string FreeAllowanceUnitTypeName { get; set; }
    public string ConditionalNote { get; set; }
    public int CalculationOrder { get; set; }
    public bool AlreadyApplied { get; set; }
}
