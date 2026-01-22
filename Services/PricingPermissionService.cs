using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;

namespace DespatchWeb.Services;

/// <summary>
/// Service for validating pricing-related permissions.
/// Currently allows all operations - permission checks can be enabled later.
/// </summary>
public class PricingPermissionService : IPricingPermissionService
{
    // Valid pricing modes
    private static readonly HashSet<string> ValidPricingModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "recalculate",
        "base",
        "gross"
    };

    /// <inheritdoc />
    public Task<bool> CanModifyPricesAsync() => Task.FromResult(true);

    /// <inheritdoc />
    public Task<bool> CanUsePricingModeAsync(string pricingMode)
    {
        // Allow all valid pricing modes
        var isValid = !string.IsNullOrEmpty(pricingMode) && ValidPricingModes.Contains(pricingMode);
        return Task.FromResult(isValid);
    }

    /// <inheritdoc />
    public Task<bool> CanBulkUpdatePricesAsync() => Task.FromResult(true);

    /// <inheritdoc />
    public Task<bool> CanModifyPriceBreakdownAsync() => Task.FromResult(true);

    /// <inheritdoc />
    public Task ValidateJobAccessAsync(int jobId)
    {
        // Allow access to all jobs for now
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<List<int>> ValidateJobsAccessAsync(List<int> jobIds)
    {
        // Return empty list (no inaccessible jobs) - allow all
        return Task.FromResult(new List<int>());
    }

    /// <inheritdoc />
    public void ValidatePricingMode(string pricingMode)
    {
        if (string.IsNullOrEmpty(pricingMode))
            throw new ArgumentException("Pricing mode is required", nameof(pricingMode));

        if (!ValidPricingModes.Contains(pricingMode))
            throw new ArgumentException($"Invalid pricing mode: {pricingMode}. Valid modes are: {string.Join(", ", ValidPricingModes)}", nameof(pricingMode));
    }

    /// <inheritdoc />
    public Task<PricingPermissions> GetPricingPermissionsAsync()
    {
        // Return all permissions enabled
        return Task.FromResult(new PricingPermissions
        {
            CanModifyPrices = true,
            CanBulkUpdate = true,
            CanRecalculate = true,
            CanSetBaseAmount = true,
            CanManageBreakdown = true
        });
    }
}
