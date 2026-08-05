using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Services;

/// <summary>
/// Service for validating pricing-related permissions.
/// Validates job access based on user type (staff vs client contact).
/// </summary>
public sealed class PricingPermissionService(
    ITenantInfoService tenantInfoService,
    IClientRepository clientRepository,
    IDbContextFactory<DespatchContext> contextFactory) : IPricingPermissionService
{
    // Valid pricing modes
    private static readonly HashSet<string> ValidPricingModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "recalculate",
        "base",
        "gross"
    };

    // Cache for accessible client IDs per request
    private HashSet<int> _accessibleClientIds;

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
    public async Task ValidateJobAccessAsync(int jobId)
    {
        // Staff members have access to all jobs
        var staffId = tenantInfoService.GetStaffId();
        if (staffId > 0)
        {
            return;
        }

        // Client contacts only have access to their clients' jobs
        var contactId = tenantInfoService.GetContactId();
        if (contactId == 0)
        {
            throw new UnauthorizedAccessException("User not authenticated");
        }

        var accessibleClientIds = await GetAccessibleClientIdsAsync(contactId);
        if (accessibleClientIds.Count == 0)
        {
            throw new UnauthorizedAccessException("User has no accessible clients");
        }

        await using var context = await contextFactory.CreateDbContextAsync();

        // Single query using TblJobs view (combines live and archived jobs)
        var hasAccess = await context.TblJobs
            .Where(j => j.JobId == jobId && j.ClientId != null && accessibleClientIds.Contains(j.ClientId.Value))
            .AnyAsync();

        if (!hasAccess)
        {
            // Check if job exists at all
            var jobExists = await context.TblJobs
                .AnyAsync(j => j.JobId == jobId);

            throw new UnauthorizedAccessException(jobExists
                ? $"Access denied to job {jobId}"
                : $"Job {jobId} not found");
        }
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<int>> ValidateJobsAccessAsync(IReadOnlyList<int> jobIds)
    {
        if (jobIds == null || jobIds.Count == 0)
        {
            return [];
        }

        // Staff members have access to all jobs
        var staffId = tenantInfoService.GetStaffId();
        if (staffId > 0)
        {
            return [];
        }

        // Client contacts only have access to their clients' jobs
        var contactId = tenantInfoService.GetContactId();
        if (contactId == 0)
        {
            return jobIds; // No access to any jobs if not authenticated
        }

        var accessibleClientIds = await GetAccessibleClientIdsAsync(contactId);
        if (accessibleClientIds.Count == 0)
        {
            return jobIds; // No access to any jobs
        }

        await using var context = await contextFactory.CreateDbContextAsync();

        // Single query: get job IDs that the user HAS access to
        var accessibleJobIds = await context.TblJobs
            .Where(j => jobIds.Contains(j.JobId) && j.ClientId != null &&
                        accessibleClientIds.Contains(j.ClientId.Value))
            .Select(j => j.JobId)
            .ToListAsync();

        // Return jobs the user does NOT have access to (set difference)
        return [.. jobIds.Except(accessibleJobIds)];
    }

    /// <inheritdoc />
    public void ValidatePricingMode(string pricingMode)
    {
        if (string.IsNullOrEmpty(pricingMode))
        {
            throw new ArgumentException("Pricing mode is required", nameof(pricingMode));
        }

        if (!ValidPricingModes.Contains(pricingMode))
        {
            throw new ArgumentException(
                $"Invalid pricing mode: {pricingMode}. Valid modes are: {string.Join(", ", ValidPricingModes)}",
                nameof(pricingMode));
        }
    }

    /// <inheritdoc />
    public Task<PricingPermissions> GetPricingPermissionsAsync() =>
        // Return all permissions enabled
        Task.FromResult(new PricingPermissions
        {
            CanModifyPrices = true,
            CanBulkUpdate = true,
            CanRecalculate = true,
            CanSetBaseAmount = true,
            CanManageBreakdown = true
        });

    /// <summary>
    /// Gets the set of client IDs the current contact has access to.
    /// Results are cached for the duration of the request.
    /// </summary>
    private async Task<HashSet<int>> GetAccessibleClientIdsAsync(int contactId)
    {
        if (_accessibleClientIds != null)
        {
            return _accessibleClientIds;
        }

        var clientContacts = await clientRepository.ClientContactsAsync(contactId);
        _accessibleClientIds = clientContacts?.Select(c => c.Id).ToHashSet() ?? [];
        return _accessibleClientIds;
    }
}