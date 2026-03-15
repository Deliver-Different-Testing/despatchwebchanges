using DespatchWeb.Enums;

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
}
