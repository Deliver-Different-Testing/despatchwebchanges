using DespatchWeb.Enums;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

/// <summary>
/// EF Core expression tree mappings for projecting job entities to view models.
/// Split into partial classes for maintainability.
/// </summary>
public static partial class JobMappings
{
    /// <summary>
    /// SQL Server minimum datetime value for safe date operations.
    /// </summary>
    private static readonly DateTime SqlMinDateTime = new(1753, 1, 1);

    /// <summary>
    /// Default string values used across mappings for consistent null handling.
    /// </summary>
    internal static class Defaults
    {
        /// <summary>Used for short, inline display of missing values (barcodes, courier codes, etc.)</summary>
        public const string NotAvailable = "-";

        /// <summary>Used for contact information that wasn't provided</summary>
        public const string NotSpecified = "Not specified";

        /// <summary>Used for pickup contact when not available</summary>
        public const string NotApplicable = "N/A";
    }

    #region Utility Methods

    internal static string FormatDate(DateTime? date)
    {
        var dateToUse = date ?? SqlMinDateTime;
        return dateToUse.ToString("MM/dd/yyyy");
    }

    internal static string FormatFullName(EntityClasses.TucStaff staff) =>
        staff.UcstFirstName + " " + staff.UcstLastName;

    internal static string GetJobTypeDescription(double? jobTypeId)
    {
        var jobType = (LateEventType?)(jobTypeId ?? (int)LateEventType.Pickup);
        return jobType switch
        {
            LateEventType.Pickup => "Pickup",
            LateEventType.Delivery => "Delivery",
            LateEventType.ThirdParty => "3rd-Party",
            _ => "Pickup"
        };
    }

    #endregion

    /// <summary>
    /// Computes proactive late pickup/delivery flags on materialized dispatch jobs.
    /// Must be called after EF query materialization since it requires the current time.
    /// </summary>
    public static void ComputeProactiveLateFlags(IList<DispatchJobViewModel> jobs, DateTime currentTenantTime)
    {
        foreach (var job in jobs)
        {
            // No time means ASAP job — skip (matches frontend guard)
            if (!job.Time.HasValue || !job.Booked.HasValue) continue;

            var isOverdue = job.Booked.Value < currentTenantTime;
            if (!isOverdue) continue;

            switch (job.StatusId)
            {
                // Proactive late pickup: pre-pickup status, not already flagged, client hasn't disabled alerts
                case (int)JobStatus.New or (int)JobStatus.Dispatched or (int)JobStatus.Accepted
                    when job.StatusId != (int)JobStatus.LatePickup
                         && job.AlertLatePickup is null or >= 0:
                    job.IsProactiveLatePickup = true;
                    break;
                // Proactive late delivery: in-transit status, not already flagged, client hasn't disabled alerts
                case (int)JobStatus.PickedUp or (int)JobStatus.InTransit
                    when job.StatusId != (int)JobStatus.LateDelivery
                         && job.AlertLateDelivery is null or >= 0:
                    job.IsProactiveLateDelivery = true;
                    break;
            }
        }
    }
}
