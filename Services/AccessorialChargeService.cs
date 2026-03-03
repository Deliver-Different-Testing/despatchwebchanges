using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;

namespace DespatchWeb.Services;

public class AccessorialChargeService(
    IAccessorialChargeRepository repository,
    ITenantInfoService tenantInfoService)
    : IAccessorialChargeService
{
    public Task<List<AccessorialChargeDto>> GetAvailableChargesAsync(int accessorialChargeGroupId, int jobId)
        => repository.GetAvailableChargesAsync(accessorialChargeGroupId, jobId);

    public Task<List<JobAccessorialChargeDto>> GetAppliedChargesAsync(int jobId)
        => repository.GetAppliedChargesAsync(jobId);

    public async Task AddChargesAsync(int jobId, List<JobAccessorialChargeCreateRequest> charges)
    {
        var staffInfo = await tenantInfoService.GetStaffInfoAsync();
        var userName = staffInfo?.Text ?? "Unknown";

        foreach (var charge in charges)
            await repository.AddChargeAsync(jobId, charge, userName);
    }

    public async Task<JobAccessorialChargeDto> UpdateChargeAsync(int jobAccessorialChargeId,
        JobAccessorialChargeUpdateRequest request)
    {
        var existing = await repository.GetAppliedChargeWithDetailsAsync(jobAccessorialChargeId);
        if (existing == null)
            throw new InvalidOperationException($"JobAccessorialCharge {jobAccessorialChargeId} not found.");

        existing.InputValue = request.InputValue;
        existing.ItemCount = request.ItemCount;
        existing.Notes = request.Notes;

        var calculatedAmount = Recalculate(existing);

        var staffInfo = await tenantInfoService.GetStaffInfoAsync();
        var userName = staffInfo?.Text ?? "Unknown";

        await repository.UpdateChargeAsync(
            jobAccessorialChargeId,
            calculatedAmount,
            request.OverrideAmount,
            request.InputValue,
            request.ItemCount,
            request.Notes,
            userName);

        existing.CalculatedAmount = calculatedAmount;
        existing.OverrideAmount = request.OverrideAmount;
        return existing;
    }

    public Task DeleteChargeAsync(int jobAccessorialChargeId)
        => repository.DeleteChargeAsync(jobAccessorialChargeId);

    public Task<decimal> GetJobAmountAsync(int jobId)
        => repository.GetJobAmountAsync(jobId);

    /// <summary>
    /// Mirrors booking's JobAccessorialChargeService.Recalculate().
    /// </summary>
    private static decimal Recalculate(JobAccessorialChargeDto jac)
    {
        decimal amount = 0;

        switch (jac.ChargeType)
        {
            case "flat":
                amount = jac.BaseRate ?? 0;
                break;

            case "per_unit":
            case "hourly":
                var billable = jac.InputValue ?? 0;

                if (jac.FreeAllowance.HasValue)
                {
                    var freeAllowance = jac.FreeAllowance.Value;
                    var inputUnit = jac.UnitTypeName ?? "";
                    var freeUnit = jac.FreeAllowanceUnitTypeName ?? "";
                    if (string.Equals(inputUnit, "Hour", StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(freeUnit, "Minute", StringComparison.OrdinalIgnoreCase))
                        freeAllowance /= 60m;
                    else if (string.Equals(inputUnit, "Minute", StringComparison.OrdinalIgnoreCase) &&
                             string.Equals(freeUnit, "Hour", StringComparison.OrdinalIgnoreCase))
                        freeAllowance *= 60m;
                    billable = Math.Max(0, billable - freeAllowance);
                }

                if (jac.MinimumQuantity.HasValue && billable < jac.MinimumQuantity.Value)
                    billable = jac.MinimumQuantity.Value;

                amount = billable * jac.ItemCount * (jac.RatePerUnit ?? 0);
                break;

            case "percentage":
                amount = (jac.InputValue ?? 0) * ((jac.PercentageRate ?? 0) / 100m);
                break;

            case "quote_based":
                amount = jac.InputValue ?? 0;
                break;
        }

        if (jac.MinimumCharge.HasValue && amount < jac.MinimumCharge.Value)
            amount = jac.MinimumCharge.Value;

        if (jac.MaximumCharge.HasValue && amount > jac.MaximumCharge.Value)
            amount = jac.MaximumCharge.Value;

        return amount;
    }
}
