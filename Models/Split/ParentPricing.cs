using DespatchWeb.EntityClasses;

namespace DespatchWeb.Models.Split;

/// <summary>
/// The parent's customer-facing figures, captured before a split or re-price touches anything.
/// </summary>
public readonly record struct ParentPricing(
    decimal? Amount,
    decimal Fuel,
    decimal? Cost,
    decimal? Distance)
{
    public static ParentPricing From(TucJob job) =>
        new(job.UcjbAmount, job.FuelSurchargeAmount, job.CourierPayment, job.TotalDistance);
}
