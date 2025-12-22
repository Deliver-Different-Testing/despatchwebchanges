namespace DespatchWeb.Models;

/// <summary>
/// Data required for calculating courier payment fields.
/// Used to aggregate data from multiple tables in a single query.
/// </summary>
public class CourierPaymentCalculationData
{
    // Job fields
    public int JobId { get; set; }
    public decimal? RawBaseAmount { get; set; }
    public decimal? FuelSurchargeAmount { get; set; }
    public decimal? CourierPercentageOverride { get; set; }
    public int? CourierId { get; set; }
    public int? ClientId { get; set; }
    public int? SpeedId { get; set; }
    public int? JobRelationshipTypeId { get; set; }

    // Job Relationship Type fields
    public bool? PostAmountToCourier { get; set; }

    // Courier fields
    public bool? CourierIsInternal { get; set; }
    public decimal? CourierPercentage { get; set; }
    public decimal? CourierBonusPercentage { get; set; }
    public int? CourierTypeId { get; set; }
    public int? CourierMasterCourierId { get; set; }
    public decimal? CourierSubContractorPercentage { get; set; }
    public decimal? CourierSubContractorFuelPercentage { get; set; }
    public decimal? CourierSubContractorBonusPercentage { get; set; }

    // Client Available Speed fields
    public decimal? ClientSpeedCourierPercentage { get; set; }

    // Job Type (Speed) fields
    public decimal? JobTypeCourierPercentage { get; set; }

    // Client fields
    public decimal? ClientCourierPercentage { get; set; }
}

/// <summary>
/// Result of courier payment calculation
/// </summary>
public class CourierPaymentResult
{
    public decimal CourierPercentage { get; set; }
    public decimal CourierPayment { get; set; }
    public decimal CourierFuel { get; set; }
    public decimal CourierBonus { get; set; }
    public int? MasterCourierId { get; set; }
    public decimal? SubContractorPercentage { get; set; }
    public decimal? SubContractorFuelPercentage { get; set; }
    public decimal? SubContractorBonusPercentage { get; set; }
}
