using System.Collections.Generic;
using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for validating pricing-related permissions for the current user.
/// </summary>
public interface IPricingPermissionService
{
    /// <summary>
    /// Checks if the current user has permission to modify job prices.
    /// </summary>
    Task<bool> CanModifyPricesAsync();

    /// <summary>
    /// Checks if the current user has permission to use a specific pricing mode.
    /// </summary>
    /// <param name="pricingMode">The pricing mode to check (recalculate, base, gross).</param>
    Task<bool> CanUsePricingModeAsync(string pricingMode);

    /// <summary>
    /// Checks if the current user has permission to perform bulk price updates.
    /// </summary>
    Task<bool> CanBulkUpdatePricesAsync();

    /// <summary>
    /// Checks if the current user has permission to modify price breakdowns.
    /// </summary>
    Task<bool> CanModifyPriceBreakdownAsync();

    /// <summary>
    /// Validates that the current user has access to a specific job.
    /// Throws UnauthorizedAccessException if access is denied.
    /// </summary>
    /// <param name="jobId">The job ID to validate access for.</param>
    Task ValidateJobAccessAsync(int jobId);

    /// <summary>
    /// Validates that the current user has access to multiple jobs.
    /// Returns the list of job IDs the user does NOT have access to.
    /// </summary>
    /// <param name="jobIds">The list of job IDs to validate access for.</param>
    /// <returns>List of inaccessible job IDs (empty if all accessible).</returns>
    Task<List<int>> ValidateJobsAccessAsync(List<int> jobIds);

    /// <summary>
    /// Validates that the pricing mode is a valid, allowed value.
    /// Throws ArgumentException if the mode is invalid.
    /// </summary>
    /// <param name="pricingMode">The pricing mode to validate.</param>
    void ValidatePricingMode(string pricingMode);

    /// <summary>
    /// Gets the current user's pricing permissions as a summary object.
    /// </summary>
    Task<PricingPermissions> GetPricingPermissionsAsync();
}

/// <summary>
/// Summary of a user's pricing-related permissions.
/// </summary>
public class PricingPermissions
{
    public bool CanModifyPrices { get; set; }
    public bool CanBulkUpdate { get; set; }
    public bool CanRecalculate { get; set; }
    public bool CanSetBaseAmount { get; set; }
    public bool CanManageBreakdown { get; set; }
}
