using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;

namespace DespatchWeb.Services;

public sealed class AccessorialChargeService(
    IAccessorialChargeRepository repository,
    ITenantInfoService tenantInfoService)
    : IAccessorialChargeService
{
    public Task<IReadOnlyList<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId)
        => repository.GetAvailableChargesAsync(accessorialChargeGroupId, jobId);

    public Task<IReadOnlyList<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId)
        => repository.GetAppliedChargesAsync(jobId);

    public async Task AddChargesAsync(int jobId, List<JobAccessorialChargeCreateRequest> charges)
    {
        var staffInfo = await tenantInfoService.GetStaffInfoAsync();
        var userName = staffInfo?.Text ?? "Unknown";

        foreach (var charge in charges)
        {
            await repository.AddChargeAsync(jobId, charge, userName);
        }
    }

    public async Task<JobAccessorialChargeDto> UpdateChargeAsync(int jobAccessorialChargeId,
        JobAccessorialChargeUpdateRequest request)
    {
        var existing = await repository.GetAppliedChargeWithDetailsAsync(jobAccessorialChargeId)
            ?? throw new InvalidOperationException($"JobAccessorialCharge {jobAccessorialChargeId} not found.");

        var updated = existing with
        {
            InputValue = request.InputValue,
            ItemCount = request.ItemCount,
            Notes = request.Notes
        };

        var calculatedAmount = Recalculate(updated);
        var driverCalculatedAmount = RecalculateDriver(updated, calculatedAmount);

        var staffInfo = await tenantInfoService.GetStaffInfoAsync();
        var userName = staffInfo?.Text ?? "Unknown";

        await repository.UpdateChargeAsync(
            jobAccessorialChargeId,
            calculatedAmount,
            request.OverrideAmount,
            driverCalculatedAmount,
            request.DriverOverrideAmount,
            request.InputValue,
            request.ItemCount,
            request.Notes,
            userName);

        return updated with
        {
            CalculatedAmount = calculatedAmount,
            OverrideAmount = request.OverrideAmount,
            DriverCalculatedAmount = driverCalculatedAmount,
            DriverOverrideAmount = request.DriverOverrideAmount
        };
    }

    public Task DeleteChargeAsync(int jobAccessorialChargeId)
        => repository.DeleteChargeAsync(jobAccessorialChargeId);

    public Task<decimal> GetJobAmountAsync(int jobId)
        => repository.GetJobAmountAsync(jobId);

    public Task<IReadOnlyList<PortionJobInfoDto>> GetPortionJobsAsync(int parentJobId)
        => repository.GetPortionJobsAsync(parentJobId);

    /// <summary>
    /// Mirrors booking's JobAccessorialChargeService.Recalculate().
    /// </summary>
    private static decimal Recalculate(JobAccessorialChargeDto jac)
    {
        var amount = jac.ChargeType switch
        {
            ChargeType.Flat => jac.BaseRate ?? 0,
            ChargeType.PerUnit or ChargeType.Hourly => CalculateBillableAmount(jac),
            ChargeType.Percentage => (jac.InputValue ?? 0) * ((jac.PercentageRate ?? 0) / 100m),
            ChargeType.QuoteBased => jac.InputValue ?? 0,
            _ => 0m
        };

        amount = Math.Max(amount, jac.MinimumCharge ?? 0);
        if (jac.MaximumCharge.HasValue && amount > jac.MaximumCharge.Value)
        {
            amount = jac.MaximumCharge.Value;
        }

        return amount;
    }

    /// <summary>
    /// Mirrors the driver calculation in sp_AddJobAccessorial. Driver percentage is a percentage of the charge amount
    /// (after min/max), not of the job amount. Null when the charge has no driver rate for its type.
    /// The charge amount is rounded to 2dp first (away from zero), matching the decimal(10,2) assignment in
    /// sp_AddJobAccessorial, so adding and editing a charge give the same driver amount.
    /// </summary>
    private static decimal? RecalculateDriver(JobAccessorialChargeDto jac, decimal chargeAmount) =>
        jac.ChargeType switch
        {
            ChargeType.Flat => jac.DriverBaseRate,
            ChargeType.PerUnit or ChargeType.Hourly => jac.DriverRatePerUnit.HasValue
                ? CalculateBillableUnits(jac) * jac.ItemCount * jac.DriverRatePerUnit.Value
                : null,
            ChargeType.Percentage => jac.DriverPercentageRate.HasValue
                ? Math.Round(chargeAmount, 2, MidpointRounding.AwayFromZero) * (jac.DriverPercentageRate.Value / 100m)
                : null,
            _ => null
        };

    private static decimal CalculateBillableAmount(JobAccessorialChargeDto jac) =>
        CalculateBillableUnits(jac) * jac.ItemCount * (jac.RatePerUnit ?? 0);

    private static decimal CalculateBillableUnits(JobAccessorialChargeDto jac)
    {
        var billable = jac.InputValue ?? 0;

        if (jac.FreeAllowance.HasValue)
        {
            var freeAllowance = jac.FreeAllowance.Value;
            var inputUnit = jac.UnitTypeName ?? string.Empty;
            var freeUnit = jac.FreeAllowanceUnitTypeName ?? string.Empty;
            if (string.Equals(inputUnit, "Hour", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(freeUnit, "Minute", StringComparison.OrdinalIgnoreCase))
            {
                freeAllowance /= 60m;
            }
            else if (string.Equals(inputUnit, "Minute", StringComparison.OrdinalIgnoreCase) &&
                     string.Equals(freeUnit, "Hour", StringComparison.OrdinalIgnoreCase))
            {
                freeAllowance *= 60m;
            }

            billable = Math.Max(0, billable - freeAllowance);
        }

        if (jac.MinimumQuantity.HasValue && billable < jac.MinimumQuantity.Value)
        {
            billable = jac.MinimumQuantity.Value;
        }

        return billable;
    }
}
